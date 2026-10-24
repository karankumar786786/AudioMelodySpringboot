package me.one_org.melody.Exceptions;

import org.springframework.http.HttpStatus;

public class TooManyRequestsException extends BaseException {
    public TooManyRequestsException(String message) {
        super(message, HttpStatus.TOO_MANY_REQUESTS);
    }
}
