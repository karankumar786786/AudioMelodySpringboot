package me.one_org.melody.Dto.Queue;

public record MailQueueDto(
    String to,
    String subject,
    String body
) {
}
