package me.one_org.melody.Utils;

import io.jsonwebtoken.Jwts;
import me.one_org.melody.Dto.Internal.JwtPayloadDto;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.util.Date;

@Component
public class JwtUtil {
    @Value("${jwt.secret:defaultSecretKeyWhichShouldBeLongEnoughToWorkProperly}")
    private String secret;

    private SecretKey getKey() {
        String effectiveSecret = (secret != null && secret.trim().length() >= 32)
                ? secret
                : "super_secret_jwt_key_that_is_at_least_32_bytes_long_and_very_secure_12345";
        return Keys.hmacShaKeyFor(effectiveSecret.getBytes(StandardCharsets.UTF_8));
    }

    public String generateToken(JwtPayloadDto payload,int expiryInHr){
        return Jwts.builder()
                .claim("id", payload.id())
                .claim("userName", payload.userName())
                .claim("email", payload.email())
                .claim("role", payload.role())
                .subject(payload.id())
                .issuedAt(new Date(System.currentTimeMillis()))
                .expiration(new Date(System.currentTimeMillis() + 1000L * 60 * 60 * expiryInHr))
                .signWith(getKey())
                .compact();
    }

    public JwtPayloadDto validateAndGetPayload(String token) {
        var claims = Jwts.parser()
                .verifyWith(getKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
        return new JwtPayloadDto(
            claims.get("id", String.class),
            claims.get("userName", String.class),
            claims.get("email", String.class),
            claims.get("role") != null ? me.one_org.melody.Enums.RoleEnum.valueOf(claims.get("role", String.class)) : null
        );
    }

    public Date getExpirationDate(String token) {
        return Jwts.parser()
                .verifyWith(getKey())
                .build()
                .parseSignedClaims(token)
                .getPayload()
                .getExpiration();
    }

    public long getRemainingSeconds(String token) {
        Date exp = getExpirationDate(token);
        if (exp == null) return 0;
        long remaining = (exp.getTime() - System.currentTimeMillis()) / 1000;
        return Math.max(remaining, 0);
    }
}
