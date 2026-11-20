package me.oneorg.melody.streams.notification;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;
import java.util.Properties;
import java.util.Set;

import org.springframework.mail.MailAuthenticationException;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.mail.javamail.MimeMessageHelper;

import jakarta.mail.internet.MimeMessage;
import software.amazon.awssdk.core.exception.SdkServiceException;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.sesv2.SesV2Client;
import software.amazon.awssdk.services.sesv2.model.Body;
import software.amazon.awssdk.services.sesv2.model.Content;
import software.amazon.awssdk.services.sesv2.model.Destination;
import software.amazon.awssdk.services.sesv2.model.EmailContent;
import software.amazon.awssdk.services.sesv2.model.Message;
import software.amazon.awssdk.services.sesv2.model.SendEmailRequest;
import tools.jackson.databind.json.JsonMapper;

/** Picks the transport from MAIL_PROVIDER, with the same env names as the Bun mail worker. */
public final class MailProviders {

    private MailProviders() {}

    public static MailProvider fromEnv(Map<String, String> env) {
        String name = env.getOrDefault("MAIL_PROVIDER", "smtp").trim().toLowerCase();
        return switch (name) {
            case "smtp" -> smtp(env);
            case "ses" -> ses(env);
            case "resend" -> resend(env, HttpClient.newHttpClient());
            case "log" -> logOnly();
            default -> throw new IllegalArgumentException("Unknown MAIL_PROVIDER \"" + name + "\". Expected smtp, ses or resend.");
        };
    }

    static MailProvider smtp(Map<String, String> env) {
        String user = env.getOrDefault("SMTP_USER", "");
        String pass = env.getOrDefault("SMTP_PASS", "").replaceAll("\\s+", "");
        int port = Integer.parseInt(env.getOrDefault("SMTP_PORT", "465"));
        JavaMailSenderImpl sender = new JavaMailSenderImpl();
        sender.setHost(env.getOrDefault("SMTP_HOST", "smtp.gmail.com"));
        sender.setPort(port);
        sender.setUsername(user);
        sender.setPassword(pass);
        Properties p = sender.getJavaMailProperties();
        p.put("mail.smtp.auth", "true");
        if (port == 465) p.put("mail.smtp.ssl.enable", "true"); else p.put("mail.smtp.starttls.enable", "true");
        p.put("mail.smtp.connectiontimeout", "10000");
        p.put("mail.smtp.timeout", "15000");
        String from = MailProvider.formatFrom(env.getOrDefault("MAIL_FROM", env.get("SMTP_FROM")), user);
        return new MailProvider() {
            public String name() { return "smtp"; }

            public String send(String to, String subject, String text) throws Exception {
                MimeMessage message = sender.createMimeMessage();
                MimeMessageHelper helper = new MimeMessageHelper(message, "UTF-8");
                helper.setFrom(from);
                helper.setTo(to);
                helper.setSubject(subject);
                helper.setText(text);
                sender.send(message);
                return message.getMessageID();
            }

            public boolean isAuthError(Throwable e) {
                String msg = String.valueOf(e.getMessage());
                return e instanceof MailAuthenticationException || msg.contains("535") || msg.contains("454")
                        || msg.toLowerCase().contains("too many login attempts");
            }
        };
    }

    private static final Set<String> SES_AUTH_ERRORS = Set.of("AccessDeniedException", "UnrecognizedClientException",
            "InvalidClientTokenId", "InvalidSignatureException", "SignatureDoesNotMatch", "ExpiredTokenException",
            "AccountSuspendedException", "SendingPausedException", "MailFromDomainNotVerifiedException");

    static MailProvider ses(Map<String, String> env) {
        String region = env.getOrDefault("SES_REGION", env.get("AWS_REGION"));
        if (region == null || region.isBlank()) throw new IllegalArgumentException("MAIL_PROVIDER=ses requires AWS_REGION (or SES_REGION)");
        String from = MailProvider.formatFrom(env.get("MAIL_FROM"), "");
        if (!from.matches(".*<[^>]+@[^>]+>.*|^[^\\s@]+@[^\\s@]+$")) {
            throw new IllegalArgumentException("MAIL_PROVIDER=ses requires MAIL_FROM with an address on a verified SES identity");
        }
        String configurationSet = env.get("SES_CONFIGURATION_SET");
        SesV2Client client = SesV2Client.builder().region(Region.of(region)).build();
        return new MailProvider() {
            public String name() { return "ses"; }

            public String send(String to, String subject, String text) {
                SendEmailRequest.Builder request = SendEmailRequest.builder()
                        .fromEmailAddress(from)
                        .destination(Destination.builder().toAddresses(to).build())
                        .content(EmailContent.builder().simple(Message.builder()
                                .subject(Content.builder().data(subject).charset("UTF-8").build())
                                .body(Body.builder().text(Content.builder().data(text).charset("UTF-8").build()).build())
                                .build()).build());
                if (configurationSet != null && !configurationSet.isBlank()) request.configurationSetName(configurationSet);
                return client.sendEmail(request.build()).messageId();
            }

            public boolean isAuthError(Throwable e) {
                if (e instanceof SdkServiceException s) {
                    String code = s instanceof software.amazon.awssdk.awscore.exception.AwsServiceException a && a.awsErrorDetails() != null
                            ? a.awsErrorDetails().errorCode() : "";
                    return SES_AUTH_ERRORS.contains(code) || s.statusCode() == 401 || s.statusCode() == 403;
                }
                return false;
            }
        };
    }

    static final class ResendException extends Exception {
        final int status;
        ResendException(String message, int status) {
            super(message);
            this.status = status;
        }
    }

    static MailProvider resend(Map<String, String> env, HttpClient http) {
        String apiKey = env.get("RESEND_API_KEY");
        if (apiKey == null || apiKey.isBlank()) throw new IllegalArgumentException("MAIL_PROVIDER=resend requires RESEND_API_KEY");
        String from = MailProvider.formatFrom(env.get("MAIL_FROM"), "");
        String endpoint = env.getOrDefault("RESEND_API_URL", "https://api.resend.com").replaceAll("/+$", "") + "/emails";
        JsonMapper json = JsonMapper.builder().build();
        return new MailProvider() {
            public String name() { return "resend"; }

            public String send(String to, String subject, String text) throws Exception {
                String body = json.writeValueAsString(Map.of("from", from, "to", new String[] {to}, "subject", subject, "text", text));
                HttpRequest request = HttpRequest.newBuilder(URI.create(endpoint))
                        .timeout(Duration.ofSeconds(15))
                        .header("Authorization", "Bearer " + apiKey)
                        .header("Content-Type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString(body))
                        .build();
                HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
                if (response.statusCode() >= 300) {
                    throw new ResendException("Resend API " + response.statusCode(), response.statusCode());
                }
                Object id = json.readValue(response.body(), Map.class).get("id");
                return id == null ? null : id.toString();
            }

            public boolean isAuthError(Throwable e) {
                return e instanceof ResendException r && (r.status == 401 || r.status == 403);
            }
        };
    }

    /** Local development: logs that an email would be sent, without its body (it may hold a code). */
    static MailProvider logOnly() {
        return new MailProvider() {
            public String name() { return "log"; }
            public String send(String to, String subject, String text) {
                org.slf4j.LoggerFactory.getLogger(MailProviders.class).info("[mail:log] would send '{}' to {}", subject, to);
                return "log-" + System.nanoTime();
            }
            public boolean isAuthError(Throwable e) { return false; }
        };
    }
}
