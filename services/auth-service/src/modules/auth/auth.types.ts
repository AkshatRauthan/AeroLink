import { UserRoleEnums } from "./auth.constants";

export type UserRole = typeof UserRoleEnums[keyof typeof UserRoleEnums];

// Repo and Service Types

export interface IUser {
    id: string;

    email: string;
    phoneNo: string;
    password: string;

    role: UserRole;
    lastLoginAt: Date;
    emailVerified: boolean;
    phoneVerified: boolean;
    profileCreated: boolean;

    createdAt: Date;
    updatedAt: Date;
}
export interface IUserRow {
    id: Buffer;

    email: string;
    phone_no: string,
    password: string;

    role: UserRole;
    last_login_at: Date;
    email_verified: boolean;
    phone_verified: boolean;
    profile_created: boolean;

    created_at: Date;
    updated_at: Date;
}


export interface IUserProfile {
    id: string;

    firstName: string;
    middleName: string | null;
    lastName: string;

    address: string | null;

    createdAt: Date;
    updatedAt: Date;
}
export interface IUserProfileRow {
    id: Buffer;

    first_name: string;
    middle_name: string | null;
    last_name: string;

    address: string | null;

    created_at: Date;
    updated_at: Date;
}


export interface AuthenticatedUser {
    jti: string,
    userId: string;
    role: UserRole;
    sessionId: string;
}


export type CreateNewUserInput = Pick<IUser, 'id' | 'email' | 'password' | 'phoneNo' | 'role'>
export type CreateNewUserRowInput = Pick<IUserRow, 'id' | 'email' | 'password' | 'phone_no' | 'role'>

export type CreateNewProfileInput = Pick<IUserProfile, 'id' | 'firstName' | 'middleName' | 'lastName' | 'address'>
export type CreateNewProfileRowInput = Pick<IUserProfileRow, 'id' | 'first_name' | 'middle_name' | 'last_name' | 'address'>


// Request/Response Types
export type ISanitisedUser = Pick<IUser, 'id' | 'email' | 'phoneNo' | 'role'>
export type ISanitisedUserProfile = Pick<IUserProfile, 'id' | 'firstName' | 'middleName' | 'lastName' | 'address'>

export type UserLoginReqBody = { email?: string, phoneNo?: string, password: string }
export type CreateNewUserReqBody = Pick<IUser, 'email' | 'password' | 'phoneNo' | 'role'>
export type CreateNewProfileReqBody = Pick<IUserProfile, 'id' | 'firstName' | 'lastName'> & Partial<Pick<IUserProfile, 'middleName' | 'address'>>;

export type UserLoginRes = { accessToken: string, user: ISanitisedUser }