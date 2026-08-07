export interface ISuccessResponse<T = unknown> {
    success: true;
    message: string,
    data: T;
}

export interface IErrorResponse {
    success: false;
    message: string;
}

export const successResponse = <T>(data: T, message: string): ISuccessResponse<T> => ({
    success: true,
    message,
    data,
});

export const errorResponse = (
    message: string,
): IErrorResponse => ({
    success: false,
    message
});