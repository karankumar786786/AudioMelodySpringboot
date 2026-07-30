package me.one_org.melody.Dto.Controllers.Authentication;

public record ResponseDto<T>(
    boolean success,
    int status,
    T data
) {
}
