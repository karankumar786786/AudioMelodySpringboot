package me.oneorg.melody.streams.notification;

/** Email bhejne ka ek tareeka (transport). workers/mailEvents/providers jaisa hi: smtp | ses | resend. */
public interface MailProvider {

    String name();

    /** @return the provider's message id, if it gives one. */
    String send(String to, String subject, String text) throws Exception;

    /** Credentials reject hue to true - tab har send fail hoga, retry ka fayda nahi. */
    boolean isAuthError(Throwable error);

    /** From header {@code "Name" <addr>} banao, jab tak value pehle se address ya poora From header na ho. */
    static String formatFrom(String raw, String fallbackAddress) {
        String value = raw == null || raw.isBlank() ? "One Melody Springboot" : raw.trim();
        if (value.contains("<") && value.contains(">")) return value;
        if (value.matches("^[^\\s@]+@[^\\s@]+$")) return value;
        return "\"" + value.replace("\"", "") + "\" <" + fallbackAddress + ">";
    }
}
