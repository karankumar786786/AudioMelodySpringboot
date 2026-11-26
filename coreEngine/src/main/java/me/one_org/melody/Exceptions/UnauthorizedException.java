package me.one_org.melody.Exceptions;

import org.springframework.http.HttpStatus;

/**
 * 401 Unauthorized: user pehchana nahi gaya - token nahi hai, galat hai ya expire ho gaya.
 * GlobalExceptionHandler isko pakad ke JSON error response bana deta hai.
 */
public class UnauthorizedException extends BaseException {
    public UnauthorizedException(String message) {
        super(message, HttpStatus.UNAUTHORIZED);
    }
}
