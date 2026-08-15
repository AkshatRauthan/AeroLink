import { UserRoleEnums } from "./auth.constants";

/**
 *  User Schema Types
 */

export type UserRole = typeof UserRoleEnums[keyof typeof UserRoleEnums];

export interface User {
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

export interface UserProfile {
    id: string;

    firstName: string;
    middleName?: string;
    lastName: string;

    phoneNo: string;
    address?: string;

    createdAt: Date;
    updatedAt: Date;
}

