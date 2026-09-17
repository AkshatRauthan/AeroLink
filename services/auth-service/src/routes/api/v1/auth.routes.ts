import { Router } from 'express';
import { AuthController } from '@root/modules/auth';
import { LogAllReqSharedMiddleware, AuthenticateAllReqSharedMiddleware } from "@root/utils";

import {
    ValidateAuthRegisterReqMiddleware, ValidateAuthLoginReqMiddleware
} from "@root/modules/auth";

const router: Router = Router();
router.use(
    LogAllReqSharedMiddleware,
);


// POST /api/v1/auth/register -> User registration
router.post(
    "/register",
    ValidateAuthRegisterReqMiddleware,
    AuthController.register,
);


// POST /api/v1/auth/login -> User login
router.post(
    "/login",
    ValidateAuthLoginReqMiddleware,
    AuthController.login,
);


router.use(
    AuthenticateAllReqSharedMiddleware,
);


// GET /api/v1/auth/me -> Fetch User details
router.get(
    "/me",
    AuthController.getMe,
);


// POST /api/v1/auth/refresh -> Refresh tokens
router.post(
    "/refresh",
    AuthController.refreshTokens,
);


// POST /api/v1/auth/logout -> User logout
router.post(
   "/logout",
   AuthController.logout,
);


export default router;