package me.one_org.melody.Shorts;

import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import lombok.extern.slf4j.Slf4j;

/** Posts events to the Inngest Event API, the same way the admin API does (core/services/inngest_service.py). */
@Component
@Slf4j
public class InngestShortEvents implements ShortEvents {

    private final ShortsProperties properties;
    private final RestClient http;

    public InngestShortEvents(ShortsProperties properties) {
        this.properties = properties;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(3));
        factory.setReadTimeout(Duration.ofSeconds(5));
        this.http = RestClient.builder().requestFactory(factory).build();
    }

    @Override
    public void send(String name, Map<String, Object> data, String eventId) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("name", name);
        body.put("data", data);
        if (eventId != null) body.put("id", eventId);
        try {
            http.post().uri(properties.resolvedInngestUrl())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .toBodilessEntity();
        } catch (Exception e) {
            log.error("Could not send Inngest event {}: {}", name, e.getMessage());
            throw new IllegalStateException("The media pipeline is unavailable, try again shortly", e);
        }
    }
}
