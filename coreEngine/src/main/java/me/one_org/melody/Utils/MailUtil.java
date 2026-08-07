package me.one_org.melody.Utils;


import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
public class MailUtil {
    private final JavaMailSender mailSender;
    @Value("${spring.mail.username}")
    private String from;
    public MailUtil(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }
    public void mail(String to,String subject,String body){
        SimpleMailMessage mail = new SimpleMailMessage();
        mail.setFrom(from);
        mail.setTo(to);
        mail.setSubject(subject);
        mail.setText(body);
        mailSender.send(mail);
    }
}
