package me.oneorg.melody.streams.notification;

/** One email transport. Mirrors workers/mailEvents/providers (smtp | ses | resend). */
public interface MailProvider {

    String name();

    /** @return the provider's message id, if it gives one. */
    String send(String to, String subject, String text) throws Exception;

    /** True when credentials were rejected, so every send would fail: no point retrying. */
    boolean isAuthError(Throwable error);

    /** {@code "Name" <addr>} unless the value already is an address or a full From header. */
    static String formatFrom(String raw, String fallbackAddress) {
        String value = raw == null || raw.isBlank() ? "One Melody Springboot" : raw.trim();
        if (value.contains("<") && value.contains(">")) return value;
        if (value.matches("^[^\\s@]+@[^\\s@]+$")) return value;
        return "\"" + value.replace("\"", "") + "\" <" + fallbackAddress + ">";
    }
}
