package me.one_org.melody.Exceptions;

import org.springframework.http.HttpStatus;

/**
 * Hamare saare "business" errors ki parent class.
 * Har child class apna HTTP status saath rakhti hai (400, 404, 409...).
 * Service code bas `throw new ResourceNotFoundException("Song not found")` karta hai,
 * aur GlobalExceptionHandler usko sahi status + JSON me badal deta hai.
 * RuntimeException hai, isliye har method pe "throws" likhne ki zaroorat nahi.
 */
public abstract class BaseException extends RuntimeException {
    private final HttpStatus status;

    public BaseException(String message, HttpStatus status) {
        super(message);
        this.status = status;
    }

    public BaseException(String message, Throwable cause, HttpStatus status) {
        super(message, cause);
        this.status = status;
    }

    public HttpStatus getStatus() {
        return status;
    }
}
