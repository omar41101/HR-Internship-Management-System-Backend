/**
 * Custom Error class for operational errors.
 * These are errors we can predict and handle gracefully.
 */
class AppError extends Error {
    constructor(message, statusCode, suggestion = null) {
        super(message);
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith("4") ? "Fail" : "Error";
        this.isOperational = true;
        this.suggestion = suggestion;
    }
}

export default AppError;
