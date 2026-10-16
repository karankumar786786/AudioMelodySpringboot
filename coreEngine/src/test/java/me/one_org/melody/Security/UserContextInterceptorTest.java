package me.one_org.melody.Security;

import java.time.Instant;
import java.util.Map;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;

import me.one_org.melody.Entity.User;

import static org.assertj.core.api.Assertions.assertThat;

class UserContextInterceptorTest {

    private final UserContextInterceptor interceptor = new UserContextInterceptor();

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("Should extract userId from CustomUserDetails into request attribute")
    void shouldExtractFromCustomUserDetails() {
        User user = User.builder().id("usr-custom-1").build();
        CustomUserDetails userDetails = new CustomUserDetails(user);
        var auth = new UsernamePasswordAuthenticationToken(userDetails, null, userDetails.getAuthorities());
        SecurityContextHolder.getContext().setAuthentication(auth);

        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();

        boolean result = interceptor.preHandle(request, response, new Object());

        assertThat(result).isTrue();
        assertThat(request.getAttribute("userId")).isEqualTo("usr-custom-1");
    }

    @Test
    @DisplayName("Should extract userId from Jwt claims into request attribute")
    void shouldExtractFromJwt() {
        Jwt jwt = new Jwt(
                "token-value",
                Instant.now(),
                Instant.now().plusSeconds(300),
                Map.of("alg", "HS256"),
                Map.of("id", "usr-jwt-99", "sub", "usr-jwt-99")
        );
        var auth = new UsernamePasswordAuthenticationToken(jwt, null, java.util.List.of());
        SecurityContextHolder.getContext().setAuthentication(auth);

        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();

        boolean result = interceptor.preHandle(request, response, new Object());

        assertThat(result).isTrue();
        assertThat(request.getAttribute("userId")).isEqualTo("usr-jwt-99");
    }

    @Test
    @DisplayName("Should do nothing for anonymous unauthenticated request")
    void shouldHandleUnauthenticated() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();

        boolean result = interceptor.preHandle(request, response, new Object());

        assertThat(result).isTrue();
        assertThat(request.getAttribute("userId")).isNull();
    }
}
