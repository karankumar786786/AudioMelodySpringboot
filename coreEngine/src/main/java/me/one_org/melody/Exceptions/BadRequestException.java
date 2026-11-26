package me.one_org.melody.Exceptions;

import org.springframework.http.HttpStatus;

/**
 * 400 Bad Request: client ne galat ya adhoora data bheja (jaise khaali songId, galat format).
 * GlobalExceptionHandler isko pakad ke JSON error response bana deta hai.
 */
public class BadRequestException extends BaseException {
    public BadRequestException(String message) {
        super(message, HttpStatus.BAD_REQUEST);
    }
}
