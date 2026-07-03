export interface ISuccessResponse<T = unknown> {
    success: true;
    data: T;
    requestId?: string;
}

export interface IErrorResponse {
    success: false;
    errorCode: string;
    message: string;
    requestId?: string;
}

export const successResponse = <T>(data: T, requestId?: string): ISuccessResponse<T> => ({
    success: true,
    data,
    requestId,
});

export const errorResponse = (
    errorCode: string,
    message: string,
    requestId?: string,
): IErrorResponse => ({
    success: false,
    errorCode,
    message,
    requestId,
});