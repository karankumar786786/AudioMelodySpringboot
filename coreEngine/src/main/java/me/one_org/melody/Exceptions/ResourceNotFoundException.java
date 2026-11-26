package me.one_org.melody.Exceptions;

import org.springframework.http.HttpStatus;

/**
 * 404 Not Found: maangi gayi cheez (song, playlist, user) database me nahi mili.
 * GlobalExceptionHandler isko pakad ke JSON error response bana deta hai.
 */
public class ResourceNotFoundException extends BaseException {
    public ResourceNotFoundException(String message) {
        super(message, HttpStatus.NOT_FOUND);
    }
}
