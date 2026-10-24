package me.one_org.melody.Dto.Controllers.Authentication;

public record AuthTempTokenResponse(
    String tempToken,
    long expiresInSeconds,
    long cooldownSeconds
) {
    public AuthTempTokenResponse(String tempToken) {
        this(tempToken, 600, 60);
    }
}
