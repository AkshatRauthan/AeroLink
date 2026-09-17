import { z } from "zod";
import { RequestHandler } from 'express';
import { ZodValidationHelper } from "@root/utils";

import { UserRoleEnums } from "./auth.constants";
import { UserLoginReqBody, CreateNewUserReqBody, CreateNewProfileReqBody } from "@root/modules/auth";


// Auth Middlewares
const loginReqSchema = z.object({
    email: z.string().email().optional(),
    phoneNo: z.string().optional(),
    password: z.string().min(8),
}) satisfies z.ZodType<UserLoginReqBody>;
export const ValidateAuthLoginReqMiddleware: RequestHandler = ZodValidationHelper(loginReqSchema);

const registerReqSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    phoneNo: z.string().min(10),
    role: z.enum([UserRoleEnums.USER, UserRoleEnums.ADMIN]),
}) satisfies z.ZodType<CreateNewUserReqBody>;
export const ValidateAuthRegisterReqMiddleware: RequestHandler = ZodValidationHelper(registerReqSchema);


// User Profile Middlewares
const createProfileReqSchema = z.object({
    id: z.string(),
    firstName: z.string(),
    middleName: z.string().nullable(),
    lastName: z.string(),
    address: z.string().nullable(),
}) satisfies z.ZodType<CreateNewProfileReqBody>;
export const ValidateProfileCreateReqMiddleware: RequestHandler = ZodValidationHelper(createProfileReqSchema);
