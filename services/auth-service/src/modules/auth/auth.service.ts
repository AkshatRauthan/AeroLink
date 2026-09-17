import argon2 from 'argon2';
import { uuidv7 } from 'uuidv7';
import { StatusCodes } from 'http-status-codes';

import { CustomError } from '@aerolink/shared';
import { CreateSessionInput, SessionService, SessionTokenPair } from '@root/modules/session';

import { UserProfileRepository, UserRepository } from './auth.repository';
import {
    CreateNewProfileReqBody, CreateNewUserReqBody, ISanitisedUser, ISanitisedUserProfile, UserRole,

} from './auth.types';
import {string} from "zod";

export const AuthService = {

    async registerUser(userData: CreateNewUserReqBody, ipAddress: string, deviceInfo: string): Promise<{ tokens: SessionTokenPair, user: ISanitisedUser }> {
        const flag = await Promise.allSettled([
            UserRepository.emailExists(userData.email),
            UserRepository.phoneNoExists(userData.phoneNo)
        ]);

        if (flag[0].status == 'fulfilled' && flag[0].value) {
            throw new CustomError("Provided email is already being used", StatusCodes.BAD_REQUEST);
        }
        if (flag[1].status == 'fulfilled' && flag[1].value) {
            throw new CustomError("Provided phoneNo is already being used", StatusCodes.BAD_REQUEST);
        }

        const hashedPassword = await argon2.hash(userData.password, {
            type: argon2.argon2id,
            memoryCost: 19456,   // ~19 MB, OWASP 2024 recommendation
            timeCost: 2,
            parallelism: 1,
        });
        const user = await UserRepository.create({ id: uuidv7(), ...userData, password: hashedPassword });

        const sessionData: CreateSessionInput = {
            userId: user.id,
            role: user.role,
            ipAddress,
            deviceInfo,
        }
        const tokens = await SessionService.createSession(sessionData);
        const sanitisedUser: ISanitisedUser =  { email: user.email, phoneNo: user.phoneNo, id: user.id, role: user.role };
        return { tokens, user: sanitisedUser }
    },


    async loginUser(email: string | undefined, phoneNo: string | undefined, plainPassword: string, ipAddress: string, deviceInfo: string): Promise<{ tokens: SessionTokenPair, user: ISanitisedUser }> {
        if ((!email) && (!phoneNo)) {
            throw new CustomError("Either email or phoneNo is required to login", StatusCodes.FORBIDDEN);
        }

        const user = (email) ? await UserRepository.findByEmail(email) :
            (phoneNo) ? await UserRepository.findByPhoneNo(phoneNo) : null;
        if (user === null) throw new CustomError("Login request denied", StatusCodes.FORBIDDEN);

        const isValid = await argon2.verify(user.password, plainPassword);
        if (!isValid) throw new CustomError("Login request denied", StatusCodes.FORBIDDEN);

        const sessionData: CreateSessionInput = {
            userId: user.id,
            role: user.role,
            ipAddress,
            deviceInfo,
        }

        const tokens = await SessionService.createSession(sessionData);
        const sanitisedUser: ISanitisedUser =  { email: user.email, phoneNo: user.phoneNo, id: user.id, role: user.role };
        return { tokens, user: sanitisedUser };
    },


    async createUserProfile(profileData: CreateNewProfileReqBody): Promise<ISanitisedUserProfile> {
        const user = await UserRepository.findById(profileData.id);
        if (user === null) {
            throw new CustomError("User profile creation request denied", StatusCodes.FORBIDDEN);
        }

        const profile = await UserProfileRepository.create({ middleName: null, address: null, ...profileData });
        await UserRepository.markProfileCreated(profileData.id);
        return {
            id: profile.id, firstName: profile.firstName, middleName: profile.middleName,
            lastName: profile.lastName, address: profile.address
        };
    },


    async getMe(userId: string): Promise<{ user: ISanitisedUser, profile: ISanitisedUserProfile }> {
        const user = await UserRepository.findById(userId);
        if (!user) {
            throw new CustomError("User with the given id do not exist", StatusCodes.NOT_FOUND);
        }

        const profile = await UserProfileRepository.findById(userId);
        if (!profile) {
            throw new CustomError("User profile creation request failed", StatusCodes.INTERNAL_SERVER_ERROR);
        }

        return {
            user: {
                id: userId, email: user.email, phoneNo: user.phoneNo, role: user.role
            },
            profile: {
                id: userId, address: profile.address,
                firstName: profile.firstName, middleName: profile.middleName, lastName: profile.lastName
            },
        };
    },


    async refreshSession(userId: string, role: UserRole, oldRefreshToken: string, sessionId: string): Promise<{ accessToken: string, refreshToken: string }> {
        await SessionService.verifySession(sessionId, userId);
        return await SessionService.refreshSession(oldRefreshToken, sessionId, userId, role);
    },


    async logoutUser(sessionId: string, userId: string): Promise<void> {
        await SessionService.revokeSession(sessionId, userId);
    },

}