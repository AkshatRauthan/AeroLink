import { StatusCodes } from "http-status-codes";
import { successResponse } from "@aerolink/shared";
import { NextFunction, Request, Response } from "express";

import { CookieConfig } from "@root/config";
import { getSessionDetails } from "@root/utils";

import { AuthService } from "./auth.service";
import {
    CreateNewUserReqBody, CreateNewProfileReqBody, UserLoginReqBody, UserLoginRes,
    AuthenticatedUser,
} from "./auth.types";


export const AuthController = {

    async login(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const cred: UserLoginReqBody = req.body;
            const { ipAddress, deviceInfo } = getSessionDetails(req);

            const { tokens, user } = await AuthService.loginUser(cred.email, cred.phoneNo, cred.password, ipAddress, deviceInfo);
            res.cookie('__rt', tokens.refreshToken, CookieConfig.refreshToken);

            const resData: UserLoginRes = { accessToken: tokens.accessToken, user };
            res
                .status(StatusCodes.OK)
                .json(successResponse(resData, "User login successful"));

        } catch (error) {
            next(error);
        }
    },


    async register(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userData: CreateNewUserReqBody = req.body;
            const { ipAddress, deviceInfo } = getSessionDetails(req);

            const { tokens, user } = await AuthService.registerUser(userData, ipAddress, deviceInfo);
            res.cookie('__rt', tokens.refreshToken, CookieConfig.refreshToken);

            const resData: UserLoginRes = { accessToken: tokens.accessToken, user };
            res
                .status(StatusCodes.OK)
                .json(successResponse(resData, "User registration successful"));

        } catch (error) {
            next(error);
        }
    },


    async refreshTokens(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const user = req.user as AuthenticatedUser;
            const oldRefreshToken = req.cookies["__rt"] as string;

            const tokens = await AuthService.refreshSession(user.userId, user.role, oldRefreshToken, user.sessionId);
            res.cookie('__rt', tokens.refreshToken, CookieConfig.refreshToken);

            const resData = { accessToken: tokens.accessToken };
            res
                .status(StatusCodes.OK)
                .json(successResponse(resData, "Tokens refreshed successfully"));

        } catch (error) {
            next(error);
        }
    },


    async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const user = req.user as AuthenticatedUser;

            await AuthService.logoutUser(user.sessionId, user.userId);

            res.clearCookie('__rt', CookieConfig.refreshToken);
            res
                .status(StatusCodes.OK)
                .json(successResponse({}, "User logout successful"))

        } catch (error) {
            next(error);
        }
    },


    async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const user = req.user as AuthenticatedUser;

            const userData = await AuthService.getMe(user.userId);
            res
                .status(StatusCodes.OK)
                .json(successResponse(userData, "User data fetching successful"))

        } catch (error) {
            next(error);
        }
    },


    async createProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const profileData = req.body as CreateNewProfileReqBody;

            const profile = await AuthService.createUserProfile(profileData);
            res
                .status(StatusCodes.OK)
                .json(successResponse({ profile }, "Profile creation successful"))

        } catch (error) {
            next(error);
        }
    },

}