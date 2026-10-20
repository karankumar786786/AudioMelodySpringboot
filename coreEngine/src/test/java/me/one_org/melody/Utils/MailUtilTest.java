package me.one_org.melody.Utils;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;

import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MailUtilTest {

    @Mock
    private JavaMailSender mailSender;

    @InjectMocks
    private MailUtil mailUtil;

    @Test
    @DisplayName("Should send simple text mail")
    void shouldSendSimpleMail() {
        mailUtil.mail("user@example.com", "Test Subject", "Hello World");

        verify(mailSender, times(1)).send(any(SimpleMailMessage.class));
    }

    @Test
    @DisplayName("Should trigger sendOtp dispatch without throwing")
    void shouldSendOtpDirectly() {
        mailUtil.sendOtp("user@example.com", "REGISTER", "123456");

        verify(mailSender, atLeastOnce()).send(any(SimpleMailMessage.class));
    }
}
