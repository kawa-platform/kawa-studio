/// Thrown by the api client for every non-2xx response. `code` is the backend's machine
/// readable error code, `field` names the offending form field when the backend says so.
export class ApiError extends Error {
    constructor(
        readonly code: string,
        message: string,
        readonly field?: string,
    ) {
        super(message);
        this.name = 'ApiError';
    }
}
