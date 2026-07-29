package me.one_org.melody.Utils;

import java.security.SecureRandom;

import org.springframework.stereotype.Component;

@Component
public class OtpUtil {
    private final SecureRandom secureRandom = new SecureRandom();

    public String generateOtp() {
        int otp = secureRandom.nextInt(1000000);
        return String.format("%06d", otp); // always 6 digits, zero-padded
    }
}