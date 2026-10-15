package me.one_org.melody.Security;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Interceptor that populates the "userId" request attribute from the authenticated
 * Spring Security context for seamless controller compatibility.
 */
@Component
public class UserContextInterceptor implements HandlerInterceptor {

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
        return true;
    }
}
