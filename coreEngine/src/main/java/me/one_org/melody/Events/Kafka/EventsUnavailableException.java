package me.one_org.melody.Events.Kafka;

import org.springframework.http.HttpStatus;

import me.one_org.melody.Exceptions.BaseException;

/** Kafka time pe event nahi le paaya. 503 jaata hai, taaki app event apne paas rakhe aur baad me dobara bheje. */
public class EventsUnavailableException extends BaseException {
    public EventsUnavailableException(String message, Throwable cause) {
        super(message, cause, HttpStatus.SERVICE_UNAVAILABLE);
    }
}
