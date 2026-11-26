package me.one_org.melody.Utils;

import java.security.SecureRandom;

import org.springframework.stereotype.Component;

/**
 * 6 digit ka OTP banata hai.
 * SecureRandom use karte hain (normal Random nahi), kyunki normal Random ka
 * agla number guess kiya ja sakta hai - OTP ke liye ye safe nahi.
 */
@Component
public class OtpUtil {
    private final SecureRandom secureRandom = new SecureRandom();

    public String generateOtp() {
        int otp = secureRandom.nextInt(1000000);
        return String.format("%06d", otp); // hamesha 6 digit: 42 -> "000042"
    }
}