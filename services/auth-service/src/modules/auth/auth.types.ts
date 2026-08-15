import { UserRoleEnums } from "./auth.constants";

/**
 *  User Schema Types
 */

export type UserRole = typeof UserRoleEnums[keyof typeof UserRoleEnums];

export interface IUser {
    id: string;

    email: string;
    password: string;

    role: UserRole;
    lastLoginAt: Date;
    emailVerified: boolean;
    phoneVerified: boolean;
    profileCreated: boolean;

    createdAt: Date;
    updatedAt: Date;
}

export interface IUserProfile {
    id: string;

    firstName: string;
    middleName: string | null;
    lastName: string;

    phoneNo: string;
    address: string | null;

    createdAt: Date;
    updatedAt: Date;
}

