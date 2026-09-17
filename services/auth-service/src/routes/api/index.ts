import { Router } from "express";

import v1Routes from "./v1";
import healthRoutes from "./health";

const router: Router = Router();

router.use(
    "/health",
    healthRoutes
);

router.use(
    "/v1",
    v1Routes
);

export default router;