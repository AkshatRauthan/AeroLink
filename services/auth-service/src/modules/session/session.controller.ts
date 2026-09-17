import { StatusCodes } from "http-status-codes";
import { successResponse } from "@aerolink/shared";
import { NextFunction, Request, Response } from "express";

import { CookieConfig } from "@root/config";
import { getSessionDetails } from "@root/utils";
import { AuthenticatedUser } from "@root/modules/auth";

import { SessionService } from "./session.service";


export const SessionController = {

    async getAllSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const user = req.user as AuthenticatedUser;

            const sessions = await SessionService.getAllUserSessions(user.userId, user.sessionId);
            res
                .status(StatusCodes.OK)
                .json(successResponse(sessions, "User sessions found"));

        } catch (error) {
            next(error);
        }
    },


    async revokeSession(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const user = req.user as AuthenticatedUser;
            const sessionId = req.params.sessionId;

            const isCurrSession = sessionId === user.sessionId;
            await SessionService.revokeSession(user.userId, sessionId);
            if (isCurrSession) {
                res.clearCookie("__rt", CookieConfig.refreshToken);
            }

            res
                .status(StatusCodes.OK)
                .json(successResponse({ isCurrSession }, "Session revoked successfully"));
        } catch (error) {
            next(error);
        }
    },


    async revokeAllSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const user = req.user as AuthenticatedUser;

            await SessionService.revokeAllUserSessions(user.userId);
            res.clearCookie("__rt", CookieConfig.refreshToken);

            res
                .status(StatusCodes.OK)
                .json(successResponse({}, "All sessions revoked successfully"));
        } catch (error) {
            next(error);
        }
    },


}