package me.one_org.melody.Shorts;

import java.util.Map;

/** Shorts ke media pipeline events bhejne ka interface (asli kaam InngestShortEvents karta hai; tests me nakli). */
public interface ShortEvents {
    void send(String name, Map<String, Object> data, String eventId);
}
