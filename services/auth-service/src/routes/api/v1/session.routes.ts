import { Router } from 'express';
import { SessionController } from "@root/modules/session";
import { AuthenticateAllReqSharedMiddleware, LogAllReqSharedMiddleware } from "@root/utils";

const router: Router = Router();

router.use(
    LogAllReqSharedMiddleware,
    AuthenticateAllReqSharedMiddleware
)


// GET /api/v1/sessions -> Fetch all active sessions for user
router.get(
    "/",
    SessionController.getAllSessions
);


// DELETE /api/v1/sessions/all -> Revoke all user sessions
router.delete(
    "/all",
    SessionController.revokeAllSessions
);


// DELETE /api/v1/sessions/:sessionId -> Revoke a user session
router.delete(
    "/:sessionId",
    SessionController.revokeSession
);

export default router;