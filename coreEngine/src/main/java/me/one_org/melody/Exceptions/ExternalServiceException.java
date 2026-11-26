package me.one_org.melody.Exceptions;

import org.springframework.http.HttpStatus;

/**
 * 500: bahar ki service (Recombee, Algolia, mail) fail ho gayi. cause me asli error rakhte hain.
 * GlobalExceptionHandler isko pakad ke JSON error response bana deta hai.
 */
public class ExternalServiceException extends BaseException {
    public ExternalServiceException(String message) {
        super(message, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    public ExternalServiceException(String message, Throwable cause) {
        super(message, cause, HttpStatus.INTERNAL_SERVER_ERROR);
    }
}
