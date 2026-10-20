package me.one_org.melody.Dto.Queue;

/**
 * @deprecated Decommissioned on branch `alive`.
 * Replaced by direct in-process email delivery.
 */
@Deprecated(since = "alive branch - mailEvents decommissioned")
public record MailQueueDto(
    String to,
    String subject,
    String otp
) {
}
