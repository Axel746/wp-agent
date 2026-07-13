export type ApiErrorBody = { error: { code: string; message: string; details?: unknown; correlationId?: string } };

export class AppError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 400, public readonly details?: unknown) {
    super(message);
    this.name = "AppError";
  }
}

export const errorBody = (error: unknown, correlationId?: string): ApiErrorBody => {
  const appError = error instanceof AppError ? error : new AppError("INTERNAL_ERROR", "Une erreur interne est survenue", 500);
  return { error: { code: appError.code, message: appError.message, ...(appError.details === undefined ? {} : { details: appError.details }), ...(correlationId ? { correlationId } : {}) } };
};
