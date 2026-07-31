package me.one_org.melody.Utils;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import me.one_org.melody.Dto.Internal.JwtPayloadDto;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.security.Key;
import java.util.Date;

@Component
public class JwtUtil {
    @Value("${jwt.secret:defaultSecretKeyWhichShouldBeLongEnoughToWorkProperly}")
    private String secret;

    private Key getKey() {
        String effectiveSecret = (secret != null && secret.trim().length() >= 32)
                ? secret
                : "super_secret_jwt_key_that_is_at_least_32_bytes_long_and_very_secure_12345";
        return Keys.hmacShaKeyFor(effectiveSecret.getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }

    public String generateToken(JwtPayloadDto payload,int expiryInHr){
        return Jwts.builder()
                .claim("id", payload.id())
                .claim("userName", payload.userName())
                .claim("email", payload.email())
                .claim("role", payload.role())
                .setSubject(payload.id())
                .setIssuedAt(new Date(System.currentTimeMillis()))
                .setExpiration(new Date(System.currentTimeMillis() + 1000 * 60 * 60 * expiryInHr)) // 24 hours
                .signWith(getKey())
                .compact();
    }

    public JwtPayloadDto validateAndGetPayload(String token) {
        var claims = Jwts.parserBuilder()
                .setSigningKey(getKey())
                .build()
                .parseClaimsJws(token)
                .getBody();
        return new JwtPayloadDto(
            claims.get("id", String.class),
            claims.get("userName", String.class),
            claims.get("email", String.class),
            claims.get("role") != null ? me.one_org.melody.Enums.RoleEnum.valueOf(claims.get("role", String.class)) : null
        );
    }
}
