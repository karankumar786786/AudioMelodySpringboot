package me.one_org.melody.Utils;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
public class MailUtil {
    private static final Logger log = LoggerFactory.getLogger(MailUtil.class);

    private final JavaMailSender mailSender;

    @Value("${spring.mail.username:${MAIL_USERNAME:${SMTP_USER:ks1802276@gmail.com}}}")
    private String from;

    public MailUtil(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    public void mail(String to, String subject, String body) {
        SimpleMailMessage mail = new SimpleMailMessage();
        mail.setFrom(from);
        mail.setTo(to);
        mail.setSubject(subject);
        mail.setText(body);
        mailSender.send(mail);
    }

    public void sendOtp(String to, String purpose, String otp) {
        log.info("[OTP] Generated OTP for {} (purpose: {}): {}", to, purpose, otp);
        try {
            SimpleMailMessage mail = new SimpleMailMessage();
            mail.setFrom(from);
            mail.setTo(to);
            mail.setSubject("One Melody - Your Verification Code");
            mail.setText("Your OTP for " + purpose + " is: " + otp + "\nThis code will expire in 10 minutes.");
            mailSender.send(mail);
            log.info("[MAIL] Successfully sent OTP email to {}", to);
        } catch (Exception e) {
            log.error("[MAIL] Failed to send direct OTP email to {}: {}", to, e.getMessage());
        }
    }
}
