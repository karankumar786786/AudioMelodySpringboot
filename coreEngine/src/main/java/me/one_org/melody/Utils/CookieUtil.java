package me.one_org.melody.Utils;

import java.time.Duration;

import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

import jakarta.servlet.http.HttpServletResponse;
import me.one_org.melody.Configuration.CookieProperties;

/**
 * Centralized cookie builder for auth tokens.
 * Reads configuration from CookieProperties to ensure consistent
 * HttpOnly, Secure, SameSite, Domain, and MaxAge across all endpoints.
 */
@Component
public class CookieUtil {

    private final CookieProperties props;

    public CookieUtil(CookieProperties props) {
        this.props = props;
    }

    /**
     * Sets the system_token (access) and system_refresh_token cookies on the response.
     */
    public void setAuthCookies(HttpServletResponse response, String accessToken, String refreshToken) {
        if (accessToken != null) {
            ResponseCookie tokenCookie = buildCookie("system_token", accessToken,
                    Duration.ofSeconds(props.getAccessMaxAgeSeconds()));
            response.addHeader(HttpHeaders.SET_COOKIE, tokenCookie.toString());
        }
        if (refreshToken != null) {
            ResponseCookie refreshCookie = buildCookie("system_refresh_token", refreshToken,
                    Duration.ofSeconds(props.getRefreshMaxAgeSeconds()));
            response.addHeader(HttpHeaders.SET_COOKIE, refreshCookie.toString());
        }
    }

    /**
     * Clears auth cookies by setting maxAge to 0.
     */
    public void clearAuthCookies(HttpServletResponse response) {
        ResponseCookie tokenCookie = buildCookie("system_token", "", Duration.ZERO);
        ResponseCookie refreshCookie = buildCookie("system_refresh_token", "", Duration.ZERO);
        response.addHeader(HttpHeaders.SET_COOKIE, tokenCookie.toString());
        response.addHeader(HttpHeaders.SET_COOKIE, refreshCookie.toString());
    }

    private ResponseCookie buildCookie(String name, String value, Duration maxAge) {
        ResponseCookie.ResponseCookieBuilder builder = ResponseCookie.from(name, value)
                .httpOnly(true)
                .secure(props.isSecure())
                .path("/")
                .maxAge(maxAge)
                .sameSite(props.getSameSite());

        if (props.getDomain() != null && !props.getDomain().isBlank()) {
            builder.domain(props.getDomain());
        }

        return builder.build();
    }
}
