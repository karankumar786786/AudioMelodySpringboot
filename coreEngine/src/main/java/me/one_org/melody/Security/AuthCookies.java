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
 * Website (web player) ke liye login cookies.
 *
 * Mobile app token ko apne paas rakhta hai aur har request me "Authorization: Bearer ..."
 * header bhejta hai. Website me token JavaScript ki pahunch se door rakhna safe hai, isliye
 * use HttpOnly cookie me rakhte hain (HttpOnly = JS us cookie ko padh nahi sakta).
 *
 * Website har request me header {@value #CLIENT_HEADER}: {@value #WEB_CLIENT} bhejti hai.
 * Is header ke do kaam hain:
 * (a) server ko batata hai ki tokens cookie me set karo, JSON body me mat bhejo;
 * (b) CSRF se bachata hai - custom header ki wajah se browser pehle CORS "preflight" check
 *     karta hai, to koi doosri website user ki cookie use karke request nahi bhej sakti.
 * Jis request me ye header nahi hai (mobile app) wo bearer token hi use karti rahegi.
 */
@Component
public class AuthCookies {

    public static final String ACCESS_COOKIE = "melody_access";
    public static final String REFRESH_COOKIE = "melody_refresh";
    public static final String CLIENT_HEADER = "X-Melody-Client";
    public static final String WEB_CLIENT = "web";
    /** Refresh cookie sirf /auth wale endpoints pe chahiye, isliye uska path /auth hai. */
    static final String REFRESH_PATH = "/auth";

    private final String domain;
    private final boolean secure;
    private final String sameSite;
    private final Duration accessMaxAge;
    private final Duration refreshMaxAge;

    /** Cookie settings config se aati hain (domain, secure, SameSite, kitni der valid). */
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

    /** Request website se aayi hai? (X-Melody-Client: web header check karta hai) */
    public static boolean isWebClient(HttpServletRequest request) {
        return request != null && WEB_CLIENT.equalsIgnoreCase(request.getHeader(CLIENT_HEADER));
    }

    /** Response me access aur refresh token ki cookies set karta hai (jo token khaali hai use skip). */
    public void writeTokens(HttpServletResponse response, String accessToken, String refreshToken) {
        if (accessToken != null && !accessToken.isBlank()) {
            response.addHeader(HttpHeaders.SET_COOKIE, build(ACCESS_COOKIE, accessToken, "/", accessMaxAge).toString());
        }
        if (refreshToken != null && !refreshToken.isBlank()) {
            response.addHeader(HttpHeaders.SET_COOKIE, build(REFRESH_COOKIE, refreshToken, REFRESH_PATH, refreshMaxAge).toString());
        }
    }

    /** Logout: dono cookies ko khaali value aur 0 age ke saath bhejte hain, browser unhe delete kar deta hai. */
    public void clear(HttpServletResponse response) {
        response.addHeader(HttpHeaders.SET_COOKIE, build(ACCESS_COOKIE, "", "/", Duration.ZERO).toString());
        response.addHeader(HttpHeaders.SET_COOKIE, build(REFRESH_COOKIE, "", REFRESH_PATH, Duration.ZERO).toString());
    }

    /** Request me se naam se cookie ki value padhta hai; na mile ya khaali ho to null. */
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

    /**
     * Ek cookie banata hai:
     * httpOnly = JS nahi padh sakta, secure = sirf HTTPS pe jaayegi,
     * sameSite = doosri sites se aane wali requests me cookie kab jaayegi.
     */
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
