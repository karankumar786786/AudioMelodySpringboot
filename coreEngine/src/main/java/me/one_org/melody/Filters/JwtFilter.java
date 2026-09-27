package me.one_org.melody.Filters;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import me.one_org.melody.Dto.Internal.JwtPayloadDto;
import me.one_org.melody.Security.CustomUserDetails;
import me.one_org.melody.Security.TokenBlacklistService;
import me.one_org.melody.Utils.JwtUtil;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
public class JwtFilter extends OncePerRequestFilter {
    private final JwtUtil jwtUtil;
    private final TokenBlacklistService tokenBlacklistService;

    public JwtFilter(JwtUtil jwtUtil, TokenBlacklistService tokenBlacklistService) {
        this.jwtUtil = jwtUtil;
        this.tokenBlacklistService = tokenBlacklistService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        if (SecurityContextHolder.getContext().getAuthentication() != null) {
            filterChain.doFilter(request, response);
            return;
        }

        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            try {
                JwtPayloadDto jwtDto = jwtUtil.validateAndGetPayload(token);
                if (jwtDto != null && SecurityContextHolder.getContext().getAuthentication() == null) {
                    // Check if token has been revoked or user has been blocked
                    if (tokenBlacklistService.isTokenBlacklisted(token) || tokenBlacklistService.isUserBlocked(jwtDto.id())) {
                        filterChain.doFilter(request, response);
                        return;
                    }

                    CustomUserDetails userDetails = new CustomUserDetails(jwtDto);

                    if (userDetails.isEnabled() && userDetails.isAccountNonLocked()) {
                        UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(
                                userDetails,
                                null,
                                userDetails.getAuthorities()
                        );
                        authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                        SecurityContextHolder.getContext().setAuthentication(authToken);

                        // Preserved for backwards compatibility with existing @RequestAttribute("userId")
                        request.setAttribute("userId", userDetails.getId());
                    }
                }
            } catch (Exception e) {
                // Ignore invalid tokens; request remains unauthenticated and will be handled by JwtAuthenticationEntryPoint
            }
        }
        filterChain.doFilter(request, response);
    }
}
