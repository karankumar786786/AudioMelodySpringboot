package me.one_org.melody.Utils;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

@Component
public class HmacUtil {

    private static final String HMAC_SHA256 = "HmacSHA256";

    @Value("${hmac.secret:defaultHmacSecretKeyWhichShouldBeLongEnoughToWorkProperly}")
    private String secret;

    public String generate(String message) {
        try {
            Mac mac = Mac.getInstance(HMAC_SHA256);
            SecretKeySpec secretKeySpec = new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), HMAC_SHA256);
            mac.init(secretKeySpec);
            byte[] hmacBytes = mac.doFinal(message.getBytes(StandardCharsets.UTF_8));
            
            String hmacHash = HexFormat.of().formatHex(hmacBytes);
            String hexMessage = HexFormat.of().formatHex(message.getBytes(StandardCharsets.UTF_8));
            
            return hmacHash + ":" + hexMessage;
        } catch (NoSuchAlgorithmException | InvalidKeyException e) {
            throw new RuntimeException("Failed to generate HMAC", e);
        }
    }

    public boolean validate(String message, String hmacToValidate) {
        if (hmacToValidate == null || !hmacToValidate.contains(":")) {
            return false;
        }
        String expectedHmac = generate(message);
        return MessageDigest.isEqual(
                expectedHmac.getBytes(StandardCharsets.UTF_8),
                hmacToValidate.getBytes(StandardCharsets.UTF_8)
        );
    }

    public String getMessageIfValid(String hmacToValidate) {
        if (hmacToValidate == null) {
            return null;
        }
        int colonIndex = hmacToValidate.indexOf(':');
        if (colonIndex == -1) {
            return null;
        }
        String hmacHash = hmacToValidate.substring(0, colonIndex);
        String hexMessage = hmacToValidate.substring(colonIndex + 1);
        try {
            byte[] messageBytes = HexFormat.of().parseHex(hexMessage);
            String message = new String(messageBytes, StandardCharsets.UTF_8);

            Mac mac = Mac.getInstance(HMAC_SHA256);
            SecretKeySpec secretKeySpec = new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), HMAC_SHA256);
            mac.init(secretKeySpec);
            byte[] expectedBytes = mac.doFinal(messageBytes);
            String expectedHmacHash = HexFormat.of().formatHex(expectedBytes);

            if (MessageDigest.isEqual(expectedHmacHash.getBytes(StandardCharsets.UTF_8), hmacHash.getBytes(StandardCharsets.UTF_8))) {
                return message;
            }
        } catch (Exception e) {
            // Ignore parsing/decoding/mac failures and return null
        }
        return null;
    }
}
