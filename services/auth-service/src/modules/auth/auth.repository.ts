import { CustomError } from '@aerolink/shared';
import { getAllAuthPrimaryPools } from '@root/infrastructure/db';
import { AuthCache, AuthCacheKeys, AuthCacheTTL } from '@root/infrastructure/cache';
import { uuidToBinary, binaryToUuid, resolveDatabase, convertToCamelCase } from '@root/utils';
import {
    IUser, IUserRow, IUserProfile, IUserProfileRow, CreateNewProfileInput, CreateNewProfileRowInput,
    CreateNewUserInput, CreateNewUserRowInput,
} from './auth.types';


const USER_TABLE = 'users';
const PROFILE_TABLE = 'user_profiles';


export const UserRepository = {

    async findById(userId: string): Promise<IUser | null> {
        const db = resolveDatabase(userId);
        const userRow = await db<IUserRow>(USER_TABLE)
            .where({ id: uuidToBinary(userId) })
            .first();

        if (!userRow) return null;
        return convertToCamelCase(userRow);
    },


    /**
     * Login-path lookup. Checks the email->userId cache first — a hit skips
     * the all-shard fan-out entirely and resolves straight to one shard via
     * findById. A hit that points at a userId which no longer resolves
     * (stale/deleted) is treated as a miss and falls through to the fan-out
     * below, rather than trusting the stale pointer.
     */
    async findByEmail(email: string): Promise<IUser | null> {
        const cachedUserId = await AuthCache.get<string>(AuthCacheKeys.userIdByEmail(email));
        if (cachedUserId) {
            const cachedUser = await UserRepository.findById(cachedUserId);
            if (cachedUser) return cachedUser;
            // Stale pointer — self-heal by falling through to the fan-out below,
            // which will overwrite this cache entry with a correct value (or
            // leave it absent if the email genuinely doesn't exist anymore).
        }

        const pools = getAllAuthPrimaryPools();
        const result = await Promise.allSettled(
            pools.map((db) => {
                return db<IUserRow>(USER_TABLE)
                    .where({ email })
                    .first()
            })
        );

        let user: IUserRow = <IUserRow>{};
        let flag: boolean = false;

        result.forEach((res) => {
            if (res.status === 'fulfilled' && res.value !== undefined) {
                user = res.value;
                flag = true;
            }
        })

        if (!flag) return null;
        const sanitisedUser = convertToCamelCase(user);
        await AuthCache.set(AuthCacheKeys.userIdByEmail(email), sanitisedUser.id, AuthCacheTTL.userIdByEmailTTL);
        return sanitisedUser;
    },


    /** Same read-through/self-heal pattern as findByEmail, keyed by phoneNo instead. */
    async findByPhoneNo(phoneNo: string): Promise<IUser | null> {
        const cachedUserId = await AuthCache.get<string>(AuthCacheKeys.userIdByPhone(phoneNo));
        if (cachedUserId) {
            const cachedUser = await UserRepository.findById(cachedUserId);
            if (cachedUser) return cachedUser;
        }

        const pools = getAllAuthPrimaryPools();
        const result = await Promise.allSettled(
            pools.map((db) => {
                return db<IUserRow>(USER_TABLE)
                    .where({ phone_no: phoneNo })
                    .first()
            })
        );

        let user: IUserRow = <IUserRow>{};
        let flag: boolean = false;

        result.forEach((res) => {
            if (res.status === 'fulfilled' && res.value !== undefined) {
                user = res.value;
                flag = true;
            }
        })

        if (!flag) return null;
        const sanitisedUser = convertToCamelCase(user);
        await AuthCache.set(AuthCacheKeys.userIdByPhone(phoneNo), sanitisedUser.id, AuthCacheTTL.userIdByPhoneTTL);
        return sanitisedUser;
    },


    /**
     * emailExists/phoneNoExists intentionally do NOT consult the lookup
     * cache: a cache miss here doesn't prove the email/phoneNo is unused —
     * it only proves it isn't cached. Only the DB fan-out is authoritative
     * for existence checks, so registration keeps its full scan.
     */
    async emailExists(email: string): Promise<boolean> {
        const pools = getAllAuthPrimaryPools();
        const result = await Promise.allSettled(
            pools.map((db) => {
                return db<IUserRow>(USER_TABLE)
                    .where({ email })
                    .first()
                    .then(user => !!user)
            })
        )

        let exists: boolean = false;
        result.forEach((res) => {
            if (res.status === 'fulfilled') {
                exists ||= res.value
            }
        })

        return exists;
    },


    async phoneNoExists(phoneNo: string): Promise<boolean> {
        const pools = getAllAuthPrimaryPools();
        const result = await Promise.allSettled(
            pools.map((db) => {
                return db<IUserRow>(USER_TABLE)
                    .where({ phone_no: phoneNo })
                    .first()
                    .then(user => !!user)
            })
        )

        let exists: boolean = false;
        result.forEach((res) => {
            if (res.status === 'fulfilled') {
                exists ||= res.value
            }
        })

        return exists;
    },


    /**
     * Warms both lookup caches immediately on creation, so this user's very
     * next login is a cache hit rather than a cold all-shard fan-out.
     */
    async create(data: CreateNewUserInput): Promise<IUser> {
        const db = resolveDatabase(data.id);
        const row: CreateNewUserRowInput = {
            id: uuidToBinary(data.id),
            email: data.email,
            password: data.password,
            role: data.role,
            phone_no: data.phoneNo
        }

        await db<IUserRow>(USER_TABLE)
            .insert(row);

        const insertedUser = await db<IUserRow>(USER_TABLE).where({ id: row.id }).first();
        if (!insertedUser) throw new CustomError('Failed to create a new user', 500);
        const sanitisedUser = convertToCamelCase(insertedUser);

        await Promise.allSettled([
            AuthCache.set(AuthCacheKeys.userIdByEmail(sanitisedUser.email), sanitisedUser.id, AuthCacheTTL.userIdByEmailTTL),
            AuthCache.set(AuthCacheKeys.userIdByPhone(sanitisedUser.phoneNo), sanitisedUser.id, AuthCacheTTL.userIdByPhoneTTL),
        ]);

        return sanitisedUser;
    },


    async updatePassword(userId: string, newPassword: string): Promise<void> {
        const db = resolveDatabase(userId);
        const matchedCount = await db<IUserRow>(USER_TABLE)
            .where({ id: uuidToBinary(userId) })
            .update({ password: newPassword });

        if (matchedCount === 0) throw new CustomError("User to be updated is not found", 404);
    },


    /**
     * This both marks verification AND rewrites the email column — a rename,
     * not just a flag flip. So the lookup cache needs the OLD email to
     * invalidate the stale key, which the DB update alone can't give us
     * since it only knows the new value. Fetch the current row first, do
     * the update, then swap the cache entries: delete old key, set new one.
     */
    async markEmailVerified(userId: string, email: string): Promise<void> {
        const db = resolveDatabase(userId);
        const existingUser = await UserRepository.findById(userId);

        const matchedCount = await db<IUserRow>(USER_TABLE)
            .where({ id: uuidToBinary(userId) })
            .update({ email_verified: true, email: email })

        if (matchedCount === 0) throw new CustomError("User to be updated is not found", 404);

        const invalidations: Promise<unknown>[] = [];
        if (existingUser && existingUser.email !== email) {
            invalidations.push(AuthCache.invalidate(AuthCacheKeys.userIdByEmail(existingUser.email)));
        }
        invalidations.push(AuthCache.set(AuthCacheKeys.userIdByEmail(email), userId, AuthCacheTTL.userIdByEmailTTL));
        await Promise.allSettled(invalidations);
    },


    /** Same old-key/new-key swap as markEmailVerified, for phoneNo instead. */
    async markPhoneNoVerified(userId: string, phoneNo: string): Promise<void> {
        const db = resolveDatabase(userId);
        const existingUser = await UserRepository.findById(userId);

        const matchedCount = await db<IUserRow>(USER_TABLE)
            .where({ id: uuidToBinary(userId) })
            .update({ phone_verified: true, phone_no: phoneNo })

        if (matchedCount === 0) throw new CustomError("User to be updated is not found", 404);

        const invalidations: Promise<unknown>[] = [];
        if (existingUser && existingUser.phoneNo !== phoneNo) {
            invalidations.push(AuthCache.invalidate(AuthCacheKeys.userIdByPhone(existingUser.phoneNo)));
        }
        invalidations.push(AuthCache.set(AuthCacheKeys.userIdByPhone(phoneNo), userId, AuthCacheTTL.userIdByPhoneTTL));
        await Promise.allSettled(invalidations);
    },


    async updateLastLoginAt(userId: string): Promise<void> {
        const db = resolveDatabase(userId);
        const matchedCount = await db<IUserRow>(USER_TABLE)
            .where({ id: uuidToBinary(userId) })
            .update({ last_login_at: db.fn.now() })

        if (matchedCount === 0) throw new CustomError("User to be updated is not found", 404);
    },


    async markProfileCreated(userId: string): Promise<void> {
        const db = resolveDatabase(userId);
        const matchedCount = await db<IUserRow>(USER_TABLE)
            .where({ id: uuidToBinary(userId) })
            .update({ profile_created: true })

        if (matchedCount === 0) throw new CustomError("User to be updated is not found", 404);
    }
}


export const UserProfileRepository = {

    async findById(userId: string): Promise<IUserProfile | null> {
        const db = resolveDatabase(userId);
        const userProfile = await db<IUserProfileRow>(PROFILE_TABLE)
            .where({ id: uuidToBinary(userId) })
            .first()

        if (!userProfile) return null;
        return convertToCamelCase(userProfile);
    },


    async create(data: CreateNewProfileInput): Promise<IUserProfile> {
        const db = resolveDatabase(data.id);
        const row: CreateNewProfileRowInput = {
            id: uuidToBinary(data.id),
            address: data.address,
            first_name: data.firstName,
            middle_name: data.middleName,
            last_name: data.lastName
        }
        await db<IUserProfileRow>(PROFILE_TABLE)
            .insert(row)

        const insertedProfile = await db<IUserProfileRow>(PROFILE_TABLE).where({ id: row.id }).first();
        if (!insertedProfile) throw new CustomError('Profile creation request denied', 500);
        return convertToCamelCase(insertedProfile);
    },


    async update(userId: string, data: Partial<CreateNewProfileInput>): Promise<void> {
        const db = resolveDatabase(userId);
        const row: Partial<IUserProfileRow> = {};
        if (data.firstName !== undefined) row.first_name = data.firstName;
        if (data.middleName !== undefined) row.middle_name = data.middleName;
        if (data.lastName !== undefined) row.last_name = data.lastName;
        if (data.address !== undefined) row.address = data.address;

        if (Object.keys(row).length === 0) return;

        const matchedCount = await db<IUserProfileRow>(PROFILE_TABLE)
            .where({ id: uuidToBinary(userId) })
            .update(row)

        if (matchedCount === 0) throw new CustomError("Profile to be updated is not found", 404);
    },
}