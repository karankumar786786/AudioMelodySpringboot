package me.one_org.melody.Utils;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.HexFormat;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class HmacUtilTest {

    @Autowired
    private HmacUtil hmacUtil;

    @Test
    void testGenerateAndValidateSuccess() {
        String message = "helloWorld_123";
        String token = hmacUtil.generate(message);

        assertNotNull(token);
        assertTrue(token.contains(":"));

        String[] parts = token.split(":");
        assertEquals(2, parts.length);
        assertEquals(64, parts[0].length()); // HMAC-SHA256 hash length in hex
        assertEquals(HexFormat.of().formatHex(message.getBytes()), parts[1]); // hex value of message

        assertTrue(hmacUtil.validate(message, token));
        assertEquals(message, hmacUtil.getMessageIfValid(token));
    }

    @Test
    void testValidateFailure() {
        String message = "helloWorld_123";
        String incorrectMessage = "helloWorld_124";
        String token = hmacUtil.generate(message);

        assertFalse(hmacUtil.validate(incorrectMessage, token));
        assertNull(hmacUtil.getMessageIfValid("invalidtoken"));
        assertNull(hmacUtil.getMessageIfValid("invalidhmachash:" + HexFormat.of().formatHex(message.getBytes())));
        assertNull(hmacUtil.getMessageIfValid(null));
    }
}
