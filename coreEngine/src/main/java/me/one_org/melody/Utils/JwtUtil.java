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
 * JWT tokens banana aur padhna.
 *
 * JWT (JSON Web Token) = ek signed string jisme user ki info (id, email, role) hoti hai.
 * Login ke baad app ko do tokens milte hain:
 * - access token  (1 ghanta) : har API request ke saath jaata hai
 * - refresh token (7 din)    : access token khatam ho to naya lene ke kaam aata hai
 * Server secret key se sign karta hai (HS256), isliye koi token ke andar ka data badal nahi sakta.
 * Encoder/decoder SecurityConfig me bante hain.
 */
@Component
public class JwtUtil {

    private final JwtEncoder jwtEncoder;
    private final JwtDecoder jwtDecoder;

    public JwtUtil(JwtEncoder jwtEncoder, JwtDecoder jwtDecoder) {
        this.jwtEncoder = jwtEncoder;
        this.jwtDecoder = jwtDecoder;
    }

    /** 1 ghante wala access token. */
    public String generateAccessToken(Authentication authentication) {
        return generateToken(authentication, Duration.ofHours(1));
    }

    /** 7 din wala refresh token. */
    public String generateRefreshToken(Authentication authentication) {
        return generateToken(authentication, Duration.ofDays(7));
    }

    /**
     * Logged-in user (Authentication) se token banata hai.
     * Principal alag alag type ka ho sakta hai, to har type ko JwtPayloadDto me badal ke
     * ek hi jagah (neeche wala generateToken) token banate hain.
     */
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

    /**
     * Asli token yahan banta hai.
     * Claims (token ke andar ka data): id, userName, email, role, jti, issue time, expiry.
     * jti = har token ka unique id - logout pe isi id ko blacklist me daalte hain.
     */
    public String generateToken(JwtPayloadDto payload, Duration duration) {
        Instant now = Instant.now();
        Instant expiresAt = now.plus(duration);

        String roleStr = payload.role() != null ? payload.role().name() : RoleEnum.USER.name();
        String jti = java.util.UUID.randomUUID().toString();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .id(jti)
                .issuer("melody")
                .issuedAt(now)
                .expiresAt(expiresAt)
                .subject(payload.id())
                .claim("id", payload.id())
                .claim("userName", payload.userName() != null ? payload.userName() : "")
                .claim("email", payload.email() != null ? payload.email() : "")
                .claim("role", roleStr)
                .claim("jti", jti)
                .build();

        JwsHeader jwsHeader = JwsHeader.with(MacAlgorithm.HS256).build();
        return jwtEncoder.encode(JwtEncoderParameters.from(jwsHeader, claims)).getTokenValue();
    }

    /** Token ka unique id (jti). Token kharab/expired ho to null. */
    public String extractJti(String token) {
        try {
            Jwt jwt = jwtDecoder.decode(token);
            String jti = jwt.getId();
            return (jti != null && !jti.isBlank()) ? jti : jwt.getClaimAsString("jti");
        } catch (Exception e) {
            return null;
        }
    }

    // Neeche ke teen methods same kaam karte hain, bas expiry ghanton (int) me lete hain.

    public String generateToken(Authentication authentication, int expiryInHr) {
        return generateToken(authentication, Duration.ofHours(expiryInHr));
    }

    public String generateToken(CustomUserDetails userDetails, int expiryInHr) {
        return generateToken(userDetails, Duration.ofHours(expiryInHr));
    }

    public String generateToken(JwtPayloadDto payload, int expiryInHr) {
        return generateToken(payload, Duration.ofHours(expiryInHr));
    }

    /**
     * Token verify karke andar ka user data deta hai.
     * Signature galat ho ya token expire ho gaya ho to decoder exception phenkta hai.
     * Role na ho to USER maan lete hain.
     */
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

    /** Token kab expire hoga. */
    public Date getExpirationDate(String token) {
        Jwt jwt = jwtDecoder.decode(token);
        Instant exp = jwt.getExpiresAt();
        return exp != null ? Date.from(exp) : null;
    }

    /**
     * Token expire hone me kitne second bache hain (kabhi negative nahi).
     * Logout pe token ko utni hi der ke liye blacklist me rakhte hain.
     */
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
