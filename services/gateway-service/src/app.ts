import { StatusCodes } from 'http-status-codes';
import express, { Application, Request, Response, NextFunction } from 'express';

import appRoutes from "@root/routes";
import { CorsConfig } from "@root/config";
import { ErrorHandler, CustomError } from '@aerolink/shared';

const app: Application = express();


app.use(CorsConfig);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


app.use(appRoutes);

app.use((req: Request, _res: Response, next: NextFunction) => {
    next(new CustomError(
        `Route ${req.method} ${req.originalUrl} not found`,
        StatusCodes.NOT_FOUND
    ));
});

app.use(ErrorHandler);

export default app;