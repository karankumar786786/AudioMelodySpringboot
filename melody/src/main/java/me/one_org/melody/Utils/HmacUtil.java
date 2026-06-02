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

@Component
public class HmacUtil {

    private static final String HMAC_SHA256 = "HmacSHA256";
    private static final int HMAC_HEX_LENGTH = 64; // SHA256 = 32 bytes = 64 hex chars

    @Value("${hmac.secret:defaultHmacSecretKeyWhichShouldBeLongEnoughToWorkProperly}")
    private String secret;

    // loaded once at startup, reused for all operations
    private SecretKeySpec secretKeySpec;

    @PostConstruct
    private void init() {
        secretKeySpec = new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), HMAC_SHA256);
    }

    // core: computes raw HMAC bytes
    private byte[] hmacBytes(byte[] messageBytes) {
        try {
            Mac mac = Mac.getInstance(HMAC_SHA256);
            mac.init(secretKeySpec);
            return mac.doFinal(messageBytes);
        } catch (NoSuchAlgorithmException | InvalidKeyException e) {
            throw new RuntimeException("Failed to compute HMAC", e);
        }
    }

    // core: builds token from raw message bytes
    private String buildToken(byte[] messageBytes) {
        String hmacHash = HexFormat.of().formatHex(hmacBytes(messageBytes));
        String hexMessage = HexFormat.of().formatHex(messageBytes);
        return hmacHash + ":" + hexMessage;
    }

    public String hash(String message) {
        return buildToken(message.getBytes(StandardCharsets.UTF_8));
    }

    public boolean validate(String message, String hmacToValidate) {
        if (hmacToValidate == null || hmacToValidate.length() < HMAC_HEX_LENGTH + 1)
            return false;
        return MessageDigest.isEqual(
                hash(message).getBytes(StandardCharsets.UTF_8),
                hmacToValidate.getBytes(StandardCharsets.UTF_8));
    }

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

    public String hashTempToken(String email) {
        byte[] bytes = new byte[32];
        new SecureRandom().nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        return buildToken((email + ":" + token).getBytes(StandardCharsets.UTF_8));
    }

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