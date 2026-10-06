export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const badRequest = (message: string) => new HttpError(400, 'BAD_REQUEST', message);
export const forbidden = (message: string) => new HttpError(403, 'FORBIDDEN', message);
export const notFound = (message: string) => new HttpError(404, 'NOT_FOUND', message);
