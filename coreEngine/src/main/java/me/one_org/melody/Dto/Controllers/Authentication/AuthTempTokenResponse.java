package me.one_org.melody.Dto.Controllers.Authentication;

/**
 * Login/register ke baad ka jawab: tempToken (OTP verify me chahiye),
 * kitne second valid hai, aur dobara OTP maangne se pehle kitna rukna hai.
 */
public record AuthTempTokenResponse(
    String tempToken,
    long expiresInSeconds,
    long cooldownSeconds
) {
    public AuthTempTokenResponse(String tempToken) {
        this(tempToken, 600, 60);
    }
}
