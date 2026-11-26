package me.one_org.melody.Security;

import org.springframework.security.oauth2.server.resource.web.BearerTokenResolver;

import jakarta.servlet.http.HttpServletRequest;

/**
 * Request me access token kahan se lena hai, ye decide karta hai. Is order me dekhta hai:
 * 1. "Authorization: Bearer <token>" header (mobile app)
 * 2. ?token=... query parameter (jaise SSE stream, jahan header nahi bhej sakte)
 * 3. HttpOnly access cookie (website) - par sirf tab jab X-Melody-Client header bhi ho,
 *    jo doosri website CORS check paas kiye bina nahi bhej sakti (CSRF se bachav).
 */
public class MelodyBearerTokenResolver implements BearerTokenResolver {

    @Override
    public String resolve(HttpServletRequest request) {
        String uri = request.getRequestURI();
        // Login/refresh aur health check wale endpoints ko token ki zaroorat nahi.
        // Yahan purana/expired token padh liya to wo bina wajah 401 de dega.
        if (uri != null && (uri.startsWith("/auth/") || uri.startsWith("/actuator/"))) {
            return null;
        }
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            return authHeader.substring(7).trim(); // "Bearer " (7 characters) hata ke bacha hua token
        }
        String tokenParam = request.getParameter("token");
        if (tokenParam != null && !tokenParam.isBlank()) {
            return tokenParam.trim();
        }
        if (AuthCookies.isWebClient(request)) {
            return AuthCookies.readCookie(request, AuthCookies.ACCESS_COOKIE);
        }
        return null;
    }
}
