package me.oneorg.melody.streams.sync;

import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.apache.avro.specific.SpecificRecord;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import com.algolia.api.SearchClient;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.recombee.api_client.RecombeeClient;
import com.recombee.api_client.api_requests.AddBookmark;
import com.recombee.api_client.api_requests.AddDetailView;
import com.recombee.api_client.api_requests.AddRating;
import com.recombee.api_client.api_requests.AddUser;
import com.recombee.api_client.api_requests.Batch;
import com.recombee.api_client.api_requests.DeleteBookmark;
import com.recombee.api_client.api_requests.Request;
import com.recombee.api_client.api_requests.SetItemValues;

import lombok.extern.slf4j.Slf4j;
import me.oneorg.melody.events.EventMeta;
import me.oneorg.melody.events.Topics;
import me.oneorg.melody.streams.config.PipelineProperties;

/**
 * syncStreams: listeners jo karte hain uske hisaab se Recombee aur Algolia ko batches me update rakhta hai.
 * Core API ki per-event calls (TelemetryEventListener aur InteractionApiService ki seedhi Recombee/Algolia
 * calls) ki jagah leta hai. Jab tak core API KAFKA mode me nahi tab tak band (melody.streams.sync-enabled),
 * taaki DUAL mode me kuch do baar na jaaye.
 */
@Component
@Profile("sync")
@Slf4j
public class SyncService {

    private static final int RECOMBEE_BATCH_MAX = 5000;

    private final RecombeeClient recombee;
    private final SearchClient algolia;
    private final String indexName;
    private final JdbcTemplate jdbc;
    private final NamedParameterJdbcTemplate named;
    private final PipelineProperties props;
    /** Haal me bheje event ids: rebalance ke baad wahi batch dobara aaye to dobara nahi bhejte. */
    private final Cache<String, Boolean> sent = Caffeine.newBuilder().maximumSize(200_000)
            .expireAfterWrite(Duration.ofHours(6)).build();

    public SyncService(RecombeeClient recombee, SearchClient algolia, @Value("${algolia.index-name}") String indexName,
                       JdbcTemplate jdbc, PipelineProperties props) {
        this.recombee = recombee;
        this.algolia = algolia;
        this.indexName = indexName;
        this.jdbc = jdbc;
        this.named = new NamedParameterJdbcTemplate(jdbc);
        this.props = props;
    }

    /** Events ka batch: duplicates hatao, plan banao, Recombee aur Algolia ko bhejo. */
    @KafkaListener(id = "sync", containerFactory = "syncFactory", autoStartup = "${melody.streams.sync-enabled:false}",
            topics = {Topics.PLAY, Topics.SKIP, Topics.SEARCH_INTERACTION, Topics.QUEUE_CHANGE, Topics.FEEDBACK,
                    Topics.FAVOURITE, Topics.PLAYLIST_SONG, Topics.ARTIST_FOLLOW, Topics.USER_LIFECYCLE})
    public void onBatch(List<ConsumerRecord<String, SpecificRecord>> records) throws Exception {
        if (!props.syncEnabled()) return;
        List<SpecificRecord> fresh = new ArrayList<>();
        List<String> ids = new ArrayList<>();
        for (ConsumerRecord<String, SpecificRecord> r : records) {
            if (r.value() == null) continue;
            String id = eventId(r.value());
            if (id != null && sent.getIfPresent(id) != null) continue;
            fresh.add(r.value());
            if (id != null) ids.add(id);
        }
        SyncPlan plan = SyncPlan.of(fresh);
        if (plan.isEmpty()) return;

        sendToRecombee(plan);
        sendToAlgolia(plan);
        ids.forEach(id -> sent.put(id, Boolean.TRUE));
        log.debug("sync: {} events -> {} ratings, {} search counts, {} stream totals",
                fresh.size(), plan.ratings.size(), plan.searchCounts.size(), plan.streamedSongs.size());
    }

    /** Plan ki ratings / views / bookmarks ek Batch request me Recombee ko. */
    private void sendToRecombee(SyncPlan plan) throws Exception {
        List<Request> requests = new ArrayList<>();
        plan.newUsers.forEach(u -> requests.add(new AddUser(u)));
        plan.ratings.forEach(r -> requests.add(new AddRating(r.userId(), r.itemId(), r.rating()).setCascadeCreate(true)));
        plan.detailViews.forEach(v -> requests.add(new AddDetailView(v.userId(), v.itemId()).setCascadeCreate(true)));
        plan.bookmarks.forEach(b -> requests.add(b.add()
                ? new AddBookmark(b.userId(), b.itemId()).setCascadeCreate(true)
                : new DeleteBookmark(b.userId(), b.itemId())));
        plan.onboarding.forEach((userId, artists) -> topSongs(artists).forEach(songId ->
                requests.add(new AddRating(userId, songId, SyncPlan.playRating(0.95)).setCascadeCreate(true))));
        totals(plan).forEach((songId, total) -> {
            Map<String, Object> values = new HashMap<>();
            values.put("totalStreams", (int) Math.min(total, Integer.MAX_VALUE));
            requests.add(new SetItemValues(songId, values).setCascadeCreate(true));
        });
        for (int i = 0; i < requests.size(); i += RECOMBEE_BATCH_MAX) {
            // Batch ke andar ek item fail ho (jaise aisa bookmark delete karna jo hai hi nahi) to wo alag se report
            // hota hai aur ignore - core API bhi yahi karta tha. Poori call fail ho to container retry karta hai.
            recombee.send(new Batch(requests.subList(i, Math.min(requests.size(), i + RECOMBEE_BATCH_MAX))));
        }
    }

    /** searchCount aur totalStreams ke partial updates Algolia ko. */
    private void sendToAlgolia(SyncPlan plan) {
        List<Map<String, Object>> updates = new ArrayList<>();
        plan.searchCounts.forEach((id, n) -> updates.add(Map.of("objectID", id,
                "searchCount", Map.of("_operation", "Increment", "value", n))));
        totals(plan).forEach((songId, total) -> updates.add(Map.of("objectID", songId, "totalStreams", total)));
        if (updates.isEmpty()) return;
        // createIfNotExists=false: telemetry se kabhi adhoora search record nahi banna chahiye.
        algolia.partialUpdateObjects(indexName, updates, false);
    }

    /** Badle hue songs ke naye totalStreams Postgres se padho. */
    private Map<String, Long> totals(SyncPlan plan) {
        if (plan.streamedSongs.isEmpty()) return Map.of();
        Map<String, Long> totals = new HashMap<>();
        named.query("SELECT song_id, total_streams FROM song_metadata WHERE song_id IN (:ids)",
                Map.of("ids", plan.streamedSongs),
                rs -> { totals.put(rs.getString(1), rs.getLong(2)); });
        return totals;
    }

    /** Har artist ke max 3 sabse zyada sune gaane - core API jaisa hi seed. */
    private List<String> topSongs(List<String> artistIds) {
        return named.queryForList("""
                SELECT id FROM (
                  SELECT s.id, ROW_NUMBER() OVER (PARTITION BY a.id ORDER BY COALESCE(m.total_streams, 0) DESC, s.created_at DESC) AS rn
                    FROM artists a
                    JOIN songs s ON s.status = 'ACTIVE' AND LOWER(s.artist_name) LIKE '%' || LOWER(a.name) || '%'
                    LEFT JOIN song_metadata m ON m.song_id = s.id
                   WHERE a.id IN (:ids)
                ) ranked WHERE rn <= 3
                """, Map.of("ids", artistIds), String.class);
    }

    /** Kisi bhi Avro event se uska event_id. */
    private static String eventId(SpecificRecord value) {
        Object meta = value.getSchema().getField("meta") == null ? null : value.get(value.getSchema().getField("meta").pos());
        return meta instanceof EventMeta m ? m.getEventId() : null;
    }

}
