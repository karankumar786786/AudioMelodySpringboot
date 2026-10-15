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

    public String generateToken(Authentication authentication, int expiryInHr) {
        Object principal = authentication.getPrincipal();
        if (principal instanceof CustomUserDetails userDetails) {
            return generateToken(userDetails, expiryInHr);
        } else if (principal instanceof User user) {
            return generateToken(new CustomUserDetails(user), expiryInHr);
        } else if (principal instanceof JwtPayloadDto payload) {
            return generateToken(payload, expiryInHr);
        } else {
            String id = authentication.getName();
            return generateToken(new JwtPayloadDto(id, id, null, RoleEnum.USER), expiryInHr);
        }
    }

    public String generateToken(CustomUserDetails userDetails, int expiryInHr) {
        return generateToken(userDetails.toJwtPayload(), expiryInHr);
    }

    public String generateToken(JwtPayloadDto payload, int expiryInHr) {
        Instant now = Instant.now();
        Instant expiresAt = now.plus(Duration.ofHours(expiryInHr));

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
