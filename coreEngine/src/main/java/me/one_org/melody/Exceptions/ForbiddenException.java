package me.one_org.melody.Exceptions;

import org.springframework.http.HttpStatus;

/**
 * 403 Forbidden: user logged-in hai par ye kaam karne ki permission nahi (jaise kisi aur ki playlist edit karna).
 * GlobalExceptionHandler isko pakad ke JSON error response bana deta hai.
 */
public class ForbiddenException extends BaseException {
    public ForbiddenException(String message) {
        super(message, HttpStatus.FORBIDDEN);
    }
}
