package me.one_org.melody.Exceptions;

import org.springframework.http.HttpStatus;

/**
 * 409 Conflict: ye cheez pehle se hai (jaise same email se dobara register, song pehle se playlist me).
 * GlobalExceptionHandler isko pakad ke JSON error response bana deta hai.
 */
public class ConflictException extends BaseException {
    public ConflictException(String message) {
        super(message, HttpStatus.CONFLICT);
    }
}
