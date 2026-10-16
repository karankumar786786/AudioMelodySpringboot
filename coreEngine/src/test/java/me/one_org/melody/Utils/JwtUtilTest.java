package me.one_org.melody.Utils;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Date;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import com.nimbusds.jose.jwk.source.JWKSource;
import com.nimbusds.jose.proc.SecurityContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;

import me.one_org.melody.Dto.Internal.JwtPayloadDto;
import me.one_org.melody.Entity.User;
import me.one_org.melody.Enums.RoleEnum;
import me.one_org.melody.Security.CustomUserDetails;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class JwtUtilTest {

    private JwtUtil jwtUtil;

    @BeforeEach
    void setUp() {
        SecretKey secretKey = new SecretKeySpec(
                "01234567890123456789012345678901".getBytes(StandardCharsets.UTF_8),
                "HmacSHA256"
        );
        JWKSource<SecurityContext> jwkSource = new ImmutableSecret<>(secretKey);
        JwtEncoder jwtEncoder = new NimbusJwtEncoder(jwkSource);
        JwtDecoder jwtDecoder = NimbusJwtDecoder.withSecretKey(secretKey)
                .macAlgorithm(MacAlgorithm.HS256)
                .build();

        jwtUtil = new JwtUtil(jwtEncoder, jwtDecoder);
    }

    @Test
    @DisplayName("Should generate access token with ~5 minute lifetime and valid claims")
    void shouldGenerateAccessTokenWithFiveMinuteLifetime() {
        User user = User.builder()
                .id("user-123")
                .userName("karan")
                .email("karan@example.com")
                .build();
        CustomUserDetails userDetails = new CustomUserDetails(user);
        Authentication authentication = new UsernamePasswordAuthenticationToken(userDetails, null, userDetails.getAuthorities());

        String token = jwtUtil.generateAccessToken(authentication);

        assertThat(token).isNotBlank();
        JwtPayloadDto payload = jwtUtil.validateAndGetPayload(token);
        assertThat(payload.id()).isEqualTo("user-123");
        assertThat(payload.userName()).isEqualTo("karan");
        assertThat(payload.email()).isEqualTo("karan@example.com");
        assertThat(payload.role()).isEqualTo(RoleEnum.USER);

        Date exp = jwtUtil.getExpirationDate(token);
        assertThat(exp).isAfter(new Date());
        long remaining = jwtUtil.getRemainingSeconds(token);
        assertThat(remaining).isBetween(280L, 305L);
    }

    @Test
    @DisplayName("Should generate refresh token with ~7 day lifetime")
    void shouldGenerateRefreshTokenWithSevenDayLifetime() {
        JwtPayloadDto payloadDto = new JwtPayloadDto("user-456", "admin", "admin@melody.com", RoleEnum.ADMIN);
        Authentication authentication = new UsernamePasswordAuthenticationToken(payloadDto, null);

        String refreshToken = jwtUtil.generateRefreshToken(authentication);

        assertThat(refreshToken).isNotBlank();
        JwtPayloadDto extracted = jwtUtil.validateAndGetPayload(refreshToken);
        assertThat(extracted.id()).isEqualTo("user-456");
        assertThat(extracted.role()).isEqualTo(RoleEnum.ADMIN);

        long remaining = jwtUtil.getRemainingSeconds(refreshToken);
        long sevenDaysInSeconds = Duration.ofDays(7).toSeconds();
        assertThat(remaining).isBetween(sevenDaysInSeconds - 30, sevenDaysInSeconds + 5);
    }

    @Test
    @DisplayName("Should reject and fail on tampered token")
    void shouldFailOnTamperedToken() {
        JwtPayloadDto payload = new JwtPayloadDto("user-1", "user", "user@test.com", RoleEnum.USER);
        String token = jwtUtil.generateToken(payload, Duration.ofMinutes(10));
        String tampered = token.substring(0, token.length() - 5) + "ABCDE";

        assertThatThrownBy(() -> jwtUtil.validateAndGetPayload(tampered))
                .isInstanceOf(Exception.class);
    }

    @Test
    @DisplayName("Should return 0 remaining seconds for invalid token")
    void shouldReturnZeroRemainingSecondsOnInvalidToken() {
        long remaining = jwtUtil.getRemainingSeconds("completely-invalid-jwt");
        assertThat(remaining).isEqualTo(0L);
    }
}
