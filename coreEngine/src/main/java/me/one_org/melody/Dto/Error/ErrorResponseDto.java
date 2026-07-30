package me.one_org.melody.Dto.Error;

import java.time.LocalDateTime;
import java.util.List;

public record ErrorResponseDto(
    int status,
    String error,
    String message,
    String path,
    LocalDateTime timestamp,
    List<String> details
) {
    public ErrorResponseDto(int status, String error, String message, String path) {
        this(status, error, message, path, LocalDateTime.now(), null);
    }

    public ErrorResponseDto(int status, String error, String message, String path, List<String> details) {
        this(status, error, message, path, LocalDateTime.now(), details);
    }
}
