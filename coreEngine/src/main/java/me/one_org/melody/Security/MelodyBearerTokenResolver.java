package me.one_org.melody.Security;

import org.springframework.security.oauth2.server.resource.web.BearerTokenResolver;

import jakarta.servlet.http.HttpServletRequest;

/**
 * Resolves the access token from, in order: the Authorization bearer header (mobile app),
 * the {@code token} query parameter, or the HttpOnly access cookie (web app). The cookie is
 * only honoured together with the {@link AuthCookies#CLIENT_HEADER} header, which browsers
 * cannot send cross-origin without passing the CORS preflight.
 */
public class MelodyBearerTokenResolver implements BearerTokenResolver {

    @Override
    public String resolve(HttpServletRequest request) {
        String uri = request.getRequestURI();
        if (uri != null && (uri.startsWith("/auth/") || uri.startsWith("/actuator/"))) {
            return null;
        }
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            return authHeader.substring(7).trim();
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
