package me.one_org.melody.Dto;

public record ResponseDto<T>(
    boolean success,
    int status,
    T data
) {
}
