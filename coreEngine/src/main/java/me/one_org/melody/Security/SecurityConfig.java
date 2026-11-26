package me.one_org.melody.Security;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import com.nimbusds.jose.jwk.source.JWKSource;
import com.nimbusds.jose.proc.SecurityContext;

import me.one_org.melody.Enums.RoleEnum;
import me.one_org.melody.Enums.StatusEnum;

/**
 * Poore core API ki security setting.
 *
 * - Login / refresh (/auth/**) aur health check sabke liye khule hain.
 * - Baaki har endpoint pe valid JWT access token chahiye.
 * - Server "stateless" hai: login ka koi server-side HTTP session nahi, har request
 *   apna token khud laati hai.
 * - JWT HS256 se sign hote hain (ek hi secret key se banana aur check karna).
 * - Logout kiye hue tokens (blacklist me) reject ho jaate hain.
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    private final CustomUserDetailsService customUserDetailsService;
    private final JwtAuthenticationEntryPoint jwtAuthenticationEntryPoint;
    private final JwtAccessDeniedHandler jwtAccessDeniedHandler;

    public SecurityConfig(
            CustomUserDetailsService customUserDetailsService,
            JwtAuthenticationEntryPoint jwtAuthenticationEntryPoint,
            JwtAccessDeniedHandler jwtAccessDeniedHandler) {
        this.customUserDetailsService = customUserDetailsService;
        this.jwtAuthenticationEntryPoint = jwtAuthenticationEntryPoint;
        this.jwtAccessDeniedHandler = jwtAccessDeniedHandler;
    }

    /**
     * JWT sign karne ki secret key.
     * HS256 ke liye key kam se kam 32 bytes ki honi chahiye; config wali chhoti ho to
     * ek fixed lambi key use hoti hai (production me hamesha apna jwt.secret set karo).
     */
    @Bean
    public SecretKey jwtSecretKey(@Value("${jwt.secret:defaultSecretKeyWhichShouldBeLongEnoughToWorkProperly}") String secret) {
        String effectiveSecret = (secret != null && secret.trim().length() >= 32)
                ? secret
                : "super_secret_jwt_key_that_is_at_least_32_bytes_long_and_very_secure_12345";
        return new SecretKeySpec(effectiveSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
    }

    /** Token verify karne wala (signature + expiry check). */
    @Bean
    public JwtDecoder jwtDecoder(SecretKey secretKey) {
        return NimbusJwtDecoder.withSecretKey(secretKey)
                .macAlgorithm(MacAlgorithm.HS256)
                .build();
    }

    /** Naya token banane wala (JwtUtil isko use karta hai). */
    @Bean
    public JwtEncoder jwtEncoder(SecretKey secretKey) {
        JWKSource<SecurityContext> immutableSecret = new ImmutableSecret<>(secretKey);
        return new NimbusJwtEncoder(immutableSecret);
    }

    /**
     * Verify hua JWT -> logged-in user (CustomUserDetails).
     * Pehle check: token logout pe blacklist me to nahi daala gaya? Daala hai to reject.
     * Phir claims (id, email, role) padh ke user object banate hain - har request pe DB call nahi.
     */
    @Bean
    public Converter<Jwt, ? extends AbstractAuthenticationToken> jwtAuthenticationConverter(
            me.one_org.melody.Services.Authentication.TokenBlacklistService tokenBlacklistService) {
        return jwt -> {
            String jti = jwt.getId();
            if (jti != null && tokenBlacklistService.isBlacklisted(jti)) {
                throw new org.springframework.security.authentication.BadCredentialsException("Token has been revoked");
            }

            String userId = jwt.getClaimAsString("id");
            if (userId == null || userId.isBlank()) {
                userId = jwt.getSubject();
            }

            String email = jwt.getClaimAsString("email");
            String userName = jwt.getClaimAsString("userName");
            String roleStr = jwt.getClaimAsString("role");
            RoleEnum role = roleStr != null && !roleStr.isBlank()
                    ? RoleEnum.valueOf(roleStr)
                    : RoleEnum.USER;

            CustomUserDetails userDetails = new CustomUserDetails(userId, email, userName, role, StatusEnum.ACTIVE);
            return new UsernamePasswordAuthenticationToken(userDetails, jwt, userDetails.getAuthorities());
        };
    }

    /**
     * Security ke saare rules ek jagah.
     * CSRF band hai kyunki hum cookie-session nahi, token use karte hain (website wali cookie
     * X-Melody-Client header + CORS se protected hai, AuthCookies dekho).
     * HSTS = browser ko bolta hai ki 1 saal tak is domain pe sirf HTTPS use karna.
     */
    @Bean
    public SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            JwtDecoder jwtDecoder,
            Converter<Jwt, ? extends AbstractAuthenticationToken> jwtAuthenticationConverter,
            CorsConfigurationSource corsConfigurationSource) throws Exception {
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource))
            .csrf(csrf -> csrf.disable())
            .headers(headers -> headers
                .frameOptions(frame -> frame.deny())
                .httpStrictTransportSecurity(hsts -> hsts
                    .includeSubDomains(true)
                    .maxAgeInSeconds(31536000)
                )
            )
            .exceptionHandling(exceptions -> exceptions
                .authenticationEntryPoint(jwtAuthenticationEntryPoint)
                .accessDeniedHandler(jwtAccessDeniedHandler)
            )
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/auth/**").permitAll()
                .requestMatchers("/actuator/health", "/actuator/health/**", "/actuator/info").permitAll()
                .requestMatchers("/api/**", "/app/**").authenticated()
                .anyRequest().authenticated()
            )
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .oauth2ResourceServer(oauth2 -> oauth2
                .bearerTokenResolver(new MelodyBearerTokenResolver())
                .jwt(jwt -> jwt
                    .decoder(jwtDecoder)
                    .jwtAuthenticationConverter(jwtAuthenticationConverter)
                )
                .authenticationEntryPoint(jwtAuthenticationEntryPoint)
                .accessDeniedHandler(jwtAccessDeniedHandler)
            )
            .authenticationProvider(authenticationProvider());

        return http.build();
    }

    /** Username/password wala provider (BCrypt hash se check). */
    public AuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider authProvider = new DaoAuthenticationProvider(customUserDetailsService);
        authProvider.setPasswordEncoder(passwordEncoder());
        return authProvider;
    }

    /**
     * CORS: kaunsi websites (origins) browser se hamari API call kar sakti hain.
     * List config se aati hai (comma se alag), jaise localhost aur *.one-org.me.
     * allowCredentials = true, taaki website ki cookies request ke saath jaa sakein.
     */
    @Bean
    public CorsConfigurationSource corsConfigurationSource(
            @Value("${cors.allowed-origins:http://localhost:3000,http://localhost:5173,https://one-melody.one-org.me,https://*.one-org.me}") String allowedOriginsStr) {
        CorsConfiguration configuration = new CorsConfiguration();
        List<String> origins = new ArrayList<>();
        if (allowedOriginsStr != null) {
            for (String origin : allowedOriginsStr.split(",")) {
                String trimmed = origin.trim();
                if (!trimmed.isEmpty()) {
                    origins.add(trimmed);
                }
            }
        }
        configuration.setAllowedOriginPatterns(origins);
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"));
        configuration.setAllowedHeaders(List.of("*"));
        configuration.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    /** Password hash karne ke liye BCrypt (slow hash, brute force mushkil). */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }
}
