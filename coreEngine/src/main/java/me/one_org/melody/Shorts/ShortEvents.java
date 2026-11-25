package me.one_org.melody.Shorts;

import java.util.Map;

/** Sends media pipeline events (Inngest) for shorts. */
public interface ShortEvents {
    void send(String name, Map<String, Object> data, String eventId);
}
