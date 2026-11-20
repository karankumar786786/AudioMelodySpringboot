package me.one_org.melody.Security;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import jakarta.servlet.http.Cookie;

import static org.assertj.core.api.Assertions.assertThat;

class MelodyBearerTokenResolverTest {

    private final MelodyBearerTokenResolver resolver = new MelodyBearerTokenResolver();

    private MockHttpServletRequest request(String uri) {
        MockHttpServletRequest req = new MockHttpServletRequest("GET", uri);
        req.setRequestURI(uri);
        return req;
    }

    @Test
    void bearerHeaderWins() {
        MockHttpServletRequest req = request("/api/user/profile");
        req.addHeader("Authorization", "Bearer header-token");
        req.addHeader(AuthCookies.CLIENT_HEADER, AuthCookies.WEB_CLIENT);
        req.setCookies(new Cookie(AuthCookies.ACCESS_COOKIE, "cookie-token"));
        assertThat(resolver.resolve(req)).isEqualTo("header-token");
    }

    @Test
    void webClientUsesAccessCookie() {
        MockHttpServletRequest req = request("/api/user/profile");
        req.addHeader(AuthCookies.CLIENT_HEADER, AuthCookies.WEB_CLIENT);
        req.setCookies(new Cookie(AuthCookies.ACCESS_COOKIE, "cookie-token"));
        assertThat(resolver.resolve(req)).isEqualTo("cookie-token");
    }

    @Test
    void cookieIgnoredWithoutClientHeader() {
        MockHttpServletRequest req = request("/api/user/profile");
        req.setCookies(new Cookie(AuthCookies.ACCESS_COOKIE, "cookie-token"));
        assertThat(resolver.resolve(req)).isNull();
    }

    @Test
    void authEndpointsNeverResolveATokenSoTheyStayPublic() {
        MockHttpServletRequest req = request("/auth/refresh-token");
        req.addHeader("Authorization", "Bearer header-token");
        req.addHeader(AuthCookies.CLIENT_HEADER, AuthCookies.WEB_CLIENT);
        req.setCookies(new Cookie(AuthCookies.ACCESS_COOKIE, "cookie-token"));
        assertThat(resolver.resolve(req)).isNull();
    }
}
