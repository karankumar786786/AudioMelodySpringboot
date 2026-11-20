package me.oneorg.melody.streams.notification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import org.apache.avro.specific.SpecificRecord;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.kafka.core.KafkaTemplate;

import me.oneorg.melody.events.EmailRequested;
import me.oneorg.melody.events.EventIds;
import me.oneorg.melody.events.Topics;

class EmailSenderTest {

    @SuppressWarnings("unchecked")
    private final KafkaTemplate<String, SpecificRecord> avro = mock(KafkaTemplate.class);
    @SuppressWarnings("unchecked")
    private final KafkaTemplate<byte[], byte[]> dlq = mock(KafkaTemplate.class);

    static class FakeProvider implements MailProvider {
        final List<String> sent = new ArrayList<>();
        Exception failWith;
        boolean auth;
        public String name() { return "fake"; }
        public String send(String to, String subject, String text) throws Exception {
            if (failWith != null) throw failWith;
            sent.add(to + "|" + subject + "|" + text);
            return "id";
        }
        public boolean isAuthError(Throwable e) { return auth; }
    }

    private static EmailRequested email(int attempt) {
        return EmailRequested.newBuilder().setMeta(EventIds.meta("e1", Instant.now(), Instant.now(), "t"))
                .setTo("a@b.com").setKind("LOGIN").setSubject("LOGIN").setBody("123456").setAttempt(attempt).build();
    }

    @Test
    void sendsOnceEvenIfTheSameEventIsDelivered() throws Exception {
        FakeProvider provider = new FakeProvider();
        EmailSender sender = new EmailSender(provider, avro, dlq);
        assertThat(sender.handle("k", email(0))).isEqualTo(EmailSender.Outcome.SENT);
        assertThat(sender.handle("k", email(0))).isEqualTo(EmailSender.Outcome.DUPLICATE);
        assertThat(provider.sent).containsExactly("a@b.com|LOGIN|123456");
    }

    @Test
    void schedulesARetryWithBackoffOnTheRetryTopic() throws Exception {
        FakeProvider provider = new FakeProvider();
        provider.failWith = new RuntimeException("timeout");
        EmailSender sender = new EmailSender(provider, avro, dlq);

        assertThat(sender.handle("k", email(0))).isEqualTo(EmailSender.Outcome.RETRY);
        ArgumentCaptor<SpecificRecord> retry = ArgumentCaptor.forClass(SpecificRecord.class);
        verify(avro).send(eq(Topics.EMAIL_RETRY), eq("k"), retry.capture());
        EmailRequested next = (EmailRequested) retry.getValue();
        assertThat(next.getAttempt()).isEqualTo(1);
        assertThat(next.getNotBefore()).isAfter(Instant.now().plusSeconds(3));
        assertThat(EmailSender.retryDelayMs(1)).isEqualTo(5000);
        assertThat(EmailSender.retryDelayMs(3)).isEqualTo(20000);
        assertThat(EmailSender.retryDelayMs(9)).isEqualTo(30000);
    }

    @Test
    @SuppressWarnings("unchecked")
    void deadLettersAfterThreeAttemptsWithoutTheCode() throws Exception {
        FakeProvider provider = new FakeProvider();
        provider.failWith = new RuntimeException("mailbox unavailable");
        EmailSender sender = new EmailSender(provider, avro, dlq);

        assertThat(sender.handle("k", email(2))).isEqualTo(EmailSender.Outcome.DLQ);
        ArgumentCaptor<ProducerRecord<byte[], byte[]>> record = ArgumentCaptor.forClass(ProducerRecord.class);
        verify(dlq).send(record.capture());
        String body = new String(record.getValue().value());
        assertThat(record.getValue().topic()).isEqualTo(Topics.DLQ);
        assertThat(body).contains("max_retries").doesNotContain("123456");
        verify(avro, never()).send(any(String.class), any(), any());
    }

    @Test
    void masksAddressesInLogs() {
        assertThat(EmailSender.maskedTo("karan@example.com")).isEqualTo("k***@example.com");
    }

    @Test
    void formatsFromHeadersLikeTheBunWorker() {
        assertThat(MailProvider.formatFrom(null, "me@x.com")).isEqualTo("\"One Melody Springboot\" <me@x.com>");
        assertThat(MailProvider.formatFrom("noreply@x.com", "")).isEqualTo("noreply@x.com");
        assertThat(MailProvider.formatFrom("\"A\" <a@x.com>", "")).isEqualTo("\"A\" <a@x.com>");
    }
}
