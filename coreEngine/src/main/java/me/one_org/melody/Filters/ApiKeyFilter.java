package me.one_org.melody.Filters;

import java.io.IOException;
import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Component
public class ApiKeyFilter extends OncePerRequestFilter{

    @Value("${spring.application.api-key}")
    private String apiKeyFromEnv;

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request){
        String path = request.getServletPath();

        return !path.startsWith("/webhook");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)throws ServletException, IOException {
            String apiKey = request.getHeader("X-API-KEY");
            if (apiKey != null && apiKeyFromEnv.equals(apiKey)) {
                SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(apiKey, null,List.of(new SimpleGrantedAuthority("ROLE_API"))));
            }
            filterChain.doFilter(request, response);
    }
}
