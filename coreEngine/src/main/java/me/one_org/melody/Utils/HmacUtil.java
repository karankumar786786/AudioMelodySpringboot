package me.one_org.melody.Utils;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;

/**
 * HMAC se signed tokens banata aur check karta hai.
 *
 * HMAC = ek secret key se message ka "signature" banana. Bina secret key ke koi
 * message badal ke sahi signature nahi bana sakta, isliye token tamper-proof ho jaata hai.
 *
 * Token ka format:  <64 hex chars ka signature>:<message ka hex>
 * Login flow me "temp token" isi se banta hai: OTP bhejne ke baad app ko ek temp token
 * milta hai, jisme email chhupa hota hai. OTP verify karte waqt usi token se email nikalte hain.
 */
@Component
public class HmacUtil {

    private static final String HMAC_SHA256 = "HmacSHA256";
    private static final int HMAC_HEX_LENGTH = 64; // SHA256 = 32 bytes = 64 hex characters

    @Value("${hmac.secret:defaultHmacSecretKeyWhichShouldBeLongEnoughToWorkProperly}")
    private String secret;

    // Key ek hi baar startup pe banti hai, phir har jagah wahi reuse hoti hai
    private SecretKeySpec secretKeySpec;

    /** Server start hote hi secret string se HMAC key bana leta hai. */
    @PostConstruct
    private void init() {
        secretKeySpec = new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), HMAC_SHA256);
    }

    /** Message ke bytes ka raw HMAC signature (32 bytes). */
    private byte[] hmacBytes(byte[] messageBytes) {
        try {
            Mac mac = Mac.getInstance(HMAC_SHA256);
            mac.init(secretKeySpec);
            return mac.doFinal(messageBytes);
        } catch (NoSuchAlgorithmException | InvalidKeyException e) {
            throw new RuntimeException("Failed to compute HMAC", e);
        }
    }

    /** "signature:message" (dono hex me) wala token banata hai. */
    private String buildToken(byte[] messageBytes) {
        String hmacHash = HexFormat.of().formatHex(hmacBytes(messageBytes));
        String hexMessage = HexFormat.of().formatHex(messageBytes);
        return hmacHash + ":" + hexMessage;
    }

    /** Kisi bhi text ka signed token banata hai. */
    public String hash(String message) {
        return buildToken(message.getBytes(StandardCharsets.UTF_8));
    }

    /**
     * Check karta hai ki token is message ke liye sahi hai ya nahi.
     * MessageDigest.isEqual "constant time" compare karta hai - hamesha same time leta hai,
     * taaki attacker time naap ke signature ka andaaza na laga sake (timing attack).
     */
    public boolean validate(String message, String hmacToValidate) {
        if (hmacToValidate == null || hmacToValidate.length() < HMAC_HEX_LENGTH + 1)
            return false;
        return MessageDigest.isEqual(
                hash(message).getBytes(StandardCharsets.UTF_8),
                hmacToValidate.getBytes(StandardCharsets.UTF_8));
    }

    /**
     * Token me se original message nikalta hai, par sirf tab jab signature sahi ho.
     * Format galat ho, hex galat ho, ya signature match na kare to null.
     */
    public String getMessageIfValid(String hmacToValidate) {
        if (hmacToValidate == null || hmacToValidate.length() < HMAC_HEX_LENGTH + 1)
            return null;
        if (hmacToValidate.charAt(HMAC_HEX_LENGTH) != ':')
            return null;

        String hexMessage = hmacToValidate.substring(HMAC_HEX_LENGTH + 1);

        try {
            byte[] messageBytes = HexFormat.of().parseHex(hexMessage);
            String message = new String(messageBytes, StandardCharsets.UTF_8);
            return validate(message, hmacToValidate) ? message : null;
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Login/register ke beech ka temporary token banata hai.
     * Message = "email:random" - random part (32 secure random bytes) har baar naya hota hai,
     * isliye same email ke do token kabhi same nahi bante.
     */
    public String hashTempToken(String email) {
        byte[] bytes = new byte[32];
        new SecureRandom().nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        return buildToken((email + ":" + token).getBytes(StandardCharsets.UTF_8));
    }

    /** Temp token valid ho to usme se email nikalta hai, warna null. */
    public String getTempTokenEmail(String tempToken) {
        String message = getMessageIfValid(tempToken);
        if (message == null)
            return null;
        int colonIndex = message.indexOf(':');
        if (colonIndex == -1)
            return null;
        return message.substring(0, colonIndex);
    }
}