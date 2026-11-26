package me.one_org.melody.Dto.Controllers.Authentication;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Website ke liye: user logged-in hai ya nahi (cookie check karke).
 * JSON me "isAuthenticated" aur "authenticated" dono fields jaati hain, purane aur naye web code ke liye.
 */
public record SessionStatusDto(
    String userId,
    String email,
    String userName,
    @JsonProperty("isAuthenticated")
    boolean isAuthenticated
) {
    public static SessionStatusDto unauthenticated() {
        return new SessionStatusDto(null, null, null, false);
    }

    public static SessionStatusDto authenticated(String userId, String email, String userName) {
        return new SessionStatusDto(userId, email, userName, true);
    }

    @JsonProperty("authenticated")
    public boolean authenticated() {
        return isAuthenticated;
    }
}
