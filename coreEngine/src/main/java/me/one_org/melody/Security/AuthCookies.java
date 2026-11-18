package me.one_org.melody.Security;

import java.time.Duration;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * HttpOnly auth cookies for the web app.
 *
 * <p>The browser client sends {@value #CLIENT_HEADER}: {@value #WEB_CLIENT}. That header
 * (a) opts the request into cookie-based auth (tokens are set as cookies and left out of
 * the JSON body) and (b) acts as CSRF protection: a custom header forces a CORS preflight,
 * so only allowed origins can send a cookie-authenticated request. Requests without the
 * header (the mobile app) keep using bearer tokens in headers and bodies.
 */
@Component
public class AuthCookies {

    public static final String ACCESS_COOKIE = "melody_access";
    public static final String REFRESH_COOKIE = "melody_refresh";
    public static final String CLIENT_HEADER = "X-Melody-Client";
    public static final String WEB_CLIENT = "web";
    /** The refresh cookie is only ever needed by /auth endpoints. */
    static final String REFRESH_PATH = "/auth";

    private final String domain;
    private final boolean secure;
    private final String sameSite;
    private final Duration accessMaxAge;
    private final Duration refreshMaxAge;

    public AuthCookies(
            @Value("${auth.cookie.domain:}") String domain,
            @Value("${auth.cookie.secure:true}") boolean secure,
            @Value("${auth.cookie.same-site:Lax}") String sameSite,
            @Value("${auth.cookie.access-max-age:3600}") long accessMaxAgeSeconds,
            @Value("${auth.cookie.refresh-max-age:604800}") long refreshMaxAgeSeconds) {
        this.domain = domain == null ? "" : domain.trim();
        this.secure = secure;
        this.sameSite = sameSite == null || sameSite.isBlank() ? "Lax" : sameSite.trim();
        this.accessMaxAge = Duration.ofSeconds(accessMaxAgeSeconds);
        this.refreshMaxAge = Duration.ofSeconds(refreshMaxAgeSeconds);
    }

    public static boolean isWebClient(HttpServletRequest request) {
        return request != null && WEB_CLIENT.equalsIgnoreCase(request.getHeader(CLIENT_HEADER));
    }

    public void writeTokens(HttpServletResponse response, String accessToken, String refreshToken) {
        if (accessToken != null && !accessToken.isBlank()) {
            response.addHeader(HttpHeaders.SET_COOKIE, build(ACCESS_COOKIE, accessToken, "/", accessMaxAge).toString());
        }
        if (refreshToken != null && !refreshToken.isBlank()) {
            response.addHeader(HttpHeaders.SET_COOKIE, build(REFRESH_COOKIE, refreshToken, REFRESH_PATH, refreshMaxAge).toString());
        }
    }

    public void clear(HttpServletResponse response) {
        response.addHeader(HttpHeaders.SET_COOKIE, build(ACCESS_COOKIE, "", "/", Duration.ZERO).toString());
        response.addHeader(HttpHeaders.SET_COOKIE, build(REFRESH_COOKIE, "", REFRESH_PATH, Duration.ZERO).toString());
    }

    public static String readCookie(HttpServletRequest request, String name) {
        if (request == null || request.getCookies() == null) {
            return null;
        }
        for (Cookie cookie : request.getCookies()) {
            if (name.equals(cookie.getName()) && cookie.getValue() != null && !cookie.getValue().isBlank()) {
                return cookie.getValue();
            }
        }
        return null;
    }

    private ResponseCookie build(String name, String value, String path, Duration maxAge) {
        ResponseCookie.ResponseCookieBuilder builder = ResponseCookie.from(name, value)
                .httpOnly(true)
                .secure(secure)
                .sameSite(sameSite)
                .path(path)
                .maxAge(maxAge);
        if (!domain.isEmpty()) {
            builder.domain(domain);
        }
        return builder.build();
    }
}
