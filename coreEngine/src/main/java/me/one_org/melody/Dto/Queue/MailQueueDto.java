package me.one_org.melody.Dto.Queue;

/**
 * Mail queue me jaane wala email: kisko, subject, aur OTP.
 */
public record MailQueueDto(
    String to,
    String subject,
    String otp
) {
}
