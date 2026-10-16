package me.one_org.melody.Utils;

import java.time.Duration;
import java.time.Instant;
import java.util.Date;

import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Component;

import me.one_org.melody.Dto.Internal.JwtPayloadDto;
import me.one_org.melody.Entity.User;
import me.one_org.melody.Enums.RoleEnum;
import me.one_org.melody.Security.CustomUserDetails;

/**
 * JWT token utility leveraging Spring Security OAuth2 Nimbus JwtEncoder and JwtDecoder.
 */
@Component
public class JwtUtil {

    private final JwtEncoder jwtEncoder;
    private final JwtDecoder jwtDecoder;

    public JwtUtil(JwtEncoder jwtEncoder, JwtDecoder jwtDecoder) {
        this.jwtEncoder = jwtEncoder;
        this.jwtDecoder = jwtDecoder;
    }

    public String generateAccessToken(Authentication authentication) {
        return generateToken(authentication, Duration.ofMinutes(5));
    }

    public String generateRefreshToken(Authentication authentication) {
        return generateToken(authentication, Duration.ofDays(7));
    }

    public String generateToken(Authentication authentication, Duration duration) {
        Object principal = authentication.getPrincipal();
        if (principal instanceof CustomUserDetails userDetails) {
            return generateToken(userDetails, duration);
        } else if (principal instanceof User user) {
            return generateToken(new CustomUserDetails(user), duration);
        } else if (principal instanceof JwtPayloadDto payload) {
            return generateToken(payload, duration);
        } else {
            String id = authentication.getName();
            return generateToken(new JwtPayloadDto(id, id, null, RoleEnum.USER), duration);
        }
    }

    public String generateToken(CustomUserDetails userDetails, Duration duration) {
        return generateToken(userDetails.toJwtPayload(), duration);
    }

    public String generateToken(JwtPayloadDto payload, Duration duration) {
        Instant now = Instant.now();
        Instant expiresAt = now.plus(duration);

        String roleStr = payload.role() != null ? payload.role().name() : RoleEnum.USER.name();

        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer("melody")
                .issuedAt(now)
                .expiresAt(expiresAt)
                .subject(payload.id())
                .claim("id", payload.id())
                .claim("userName", payload.userName() != null ? payload.userName() : "")
                .claim("email", payload.email() != null ? payload.email() : "")
                .claim("role", roleStr)
                .build();

        JwsHeader jwsHeader = JwsHeader.with(MacAlgorithm.HS256).build();
        return jwtEncoder.encode(JwtEncoderParameters.from(jwsHeader, claims)).getTokenValue();
    }

    public String generateToken(Authentication authentication, int expiryInHr) {
        return generateToken(authentication, Duration.ofHours(expiryInHr));
    }

    public String generateToken(CustomUserDetails userDetails, int expiryInHr) {
        return generateToken(userDetails, Duration.ofHours(expiryInHr));
    }

    public String generateToken(JwtPayloadDto payload, int expiryInHr) {
        return generateToken(payload, Duration.ofHours(expiryInHr));
    }

    public JwtPayloadDto validateAndGetPayload(String token) {
        Jwt jwt = jwtDecoder.decode(token);
        String id = jwt.getClaimAsString("id");
        if (id == null || id.isBlank()) {
            id = jwt.getSubject();
        }
        String userName = jwt.getClaimAsString("userName");
        String email = jwt.getClaimAsString("email");
        String roleStr = jwt.getClaimAsString("role");
        RoleEnum role = roleStr != null && !roleStr.isBlank()
                ? RoleEnum.valueOf(roleStr)
                : RoleEnum.USER;

        return new JwtPayloadDto(id, userName, email, role);
    }

    public Date getExpirationDate(String token) {
        Jwt jwt = jwtDecoder.decode(token);
        Instant exp = jwt.getExpiresAt();
        return exp != null ? Date.from(exp) : null;
    }

    public long getRemainingSeconds(String token) {
        try {
            Jwt jwt = jwtDecoder.decode(token);
            Instant exp = jwt.getExpiresAt();
            if (exp == null) return 0;
            long remaining = Duration.between(Instant.now(), exp).toSeconds();
            return Math.max(remaining, 0);
        } catch (Exception e) {
            return 0;
        }
    }
}
