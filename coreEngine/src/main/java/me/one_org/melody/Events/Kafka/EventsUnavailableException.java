package me.one_org.melody.Events.Kafka;

import org.springframework.http.HttpStatus;

import me.one_org.melody.Exceptions.BaseException;

/** Kafka couldn't take the event in time. Maps to 503 so the client keeps it and retries. */
public class EventsUnavailableException extends BaseException {
    public EventsUnavailableException(String message, Throwable cause) {
        super(message, cause, HttpStatus.SERVICE_UNAVAILABLE);
    }
}
