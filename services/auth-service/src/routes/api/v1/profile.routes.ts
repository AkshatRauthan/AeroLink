import { Router } from 'express';
import { AuthController } from '@root/modules/auth';
import { LogAllReqSharedMiddleware, AuthenticateAllReqSharedMiddleware } from "@root/utils";

import {
    ValidateProfileCreateReqMiddleware
} from "@root/modules/auth";

const router: Router = Router();

router.use(
    LogAllReqSharedMiddleware,
)


// POST /api/v1/profile -> Create the user's profile
router.post(
    "/",
    ValidateProfileCreateReqMiddleware,
    AuthController.createProfile
);


router.use(
    AuthenticateAllReqSharedMiddleware,
)

export default router;