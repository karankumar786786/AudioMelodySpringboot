package me.one_org.melody.Security;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Interceptor that populates the "userId" request attribute from the authenticated
 * Spring Security context or token parameter for seamless controller compatibility.
 */
@Component
public class UserContextInterceptor implements HandlerInterceptor {

    private final JwtDecoder jwtDecoder;

    public UserContextInterceptor() {
        this(null);
    }

    @Autowired
    public UserContextInterceptor(@Lazy @Autowired(required = false) JwtDecoder jwtDecoder) {
        this.jwtDecoder = jwtDecoder;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated()) {
            Object principal = auth.getPrincipal();
            if (principal instanceof CustomUserDetails userDetails) {
                request.setAttribute("userId", userDetails.getId());
            } else if (principal instanceof Jwt jwt) {
                String id = jwt.getClaimAsString("id");
                if (id == null || id.isBlank()) {
                    id = jwt.getSubject();
                }
                request.setAttribute("userId", id);
            }
        }

        // Support token in query parameter (?token=...) or Authorization header if not yet authenticated
        if (request.getAttribute("userId") == null && jwtDecoder != null) {
            String token = request.getParameter("token");
            if (token == null || token.isBlank()) {
                String authHeader = request.getHeader("Authorization");
                if (authHeader != null && authHeader.startsWith("Bearer ")) {
                    token = authHeader.substring(7).trim();
                }
            }

            if ((token == null || token.isBlank()) && request.getCookies() != null) {
                for (jakarta.servlet.http.Cookie c : request.getCookies()) {
                    if ("system_token".equals(c.getName()) && c.getValue() != null && !c.getValue().isBlank()) {
                        token = c.getValue();
                        break;
                    }
                }
            }

            if (token != null && !token.isBlank()) {
                try {
                    Jwt jwt = jwtDecoder.decode(token);
                    String id = jwt.getClaimAsString("id");
                    if (id == null || id.isBlank()) {
                        id = jwt.getSubject();
                    }
                    if (id != null && !id.isBlank()) {
                        request.setAttribute("userId", id);
                    }
                } catch (Exception ignored) {
                    // Invalid/expired token: continue as anonymous/guest
                }
            }
        }
        return true;
    }
}
