package me.one_org.melody.Exceptions;

import org.springframework.http.HttpStatus;

/**
 * 429 Too Many Requests: rate limit cross ho gaya (jaise bahut jaldi jaldi OTP maangna).
 * GlobalExceptionHandler isko pakad ke JSON error response bana deta hai.
 */
public class TooManyRequestsException extends BaseException {
    public TooManyRequestsException(String message) {
        super(message, HttpStatus.TOO_MANY_REQUESTS);
    }
}
