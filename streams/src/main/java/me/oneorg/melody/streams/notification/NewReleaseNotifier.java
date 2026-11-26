package me.oneorg.melody.streams.notification;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import org.apache.avro.specific.SpecificRecord;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import lombok.extern.slf4j.Slf4j;
import me.oneorg.melody.events.EmailRequested;
import me.oneorg.melody.events.EventIds;
import me.oneorg.melody.events.SongChangeType;
import me.oneorg.melody.events.SongChanged;
import me.oneorg.melody.events.Topics;
import me.oneorg.melody.streams.config.PipelineProperties;

/**
 * Naya gaana publish ho to uske artists ke har follower ke liye ek email line me lagao.
 * Followers Postgres se aate hain (har user ka sabse naya follow/unfollow event), to Kafka aane se pehle
 * follow karne wale bhi shaamil hain. Har email ek alag notification.email.v1 event hai, jise EmailSender
 * retries ke saath bhejta hai. Default me band (melody.streams.new-release-emails-enabled).
 */
@Component
@Profile("notification")
@Slf4j
public class NewReleaseNotifier {

    private final NamedParameterJdbcTemplate jdbc;
    private final KafkaTemplate<String, SpecificRecord> avro;
    private final PipelineProperties props;

    public NewReleaseNotifier(NamedParameterJdbcTemplate jdbc, KafkaTemplate<String, SpecificRecord> avroTemplate,
                              PipelineProperties props) {
        this.jdbc = jdbc;
        this.avro = avroTemplate;
        this.props = props;
    }

    /** catalog.song.v1 aaya: gaana PUBLISHED hua ho (aur feature on) to artists ke ACTIVE followers ke emails line me lagao. */
    @KafkaListener(id = "new-release", topics = Topics.CATALOG_SONG, containerFactory = "releaseFactory",
            autoStartup = "${melody.streams.new-release-emails-enabled:false}")
    public void onSongChanged(ConsumerRecord<String, SongChanged> record) {
        SongChanged song = record.value();
        if (!props.newReleaseEmailsEnabled() || song == null || song.getChange() != SongChangeType.PUBLISHED
                || song.getArtistIds().isEmpty()) {
            return;
        }
        List<String> emails = jdbc.queryForList("""
                SELECT DISTINCT u.email
                  FROM (SELECT DISTINCT ON (user_id, artist_id) user_id, artist_id, event_type
                          FROM artist_follow_events
                         WHERE artist_id IN (:artists)
                         ORDER BY user_id, artist_id, created_at DESC) latest
                  JOIN users u ON u.id = latest.user_id
                 WHERE latest.event_type = 'FOLLOW' AND u.status = 'ACTIVE'
                """, Map.of("artists", song.getArtistIds()), String.class);
        String title = song.getTitle() == null ? "a new song" : song.getTitle();
        String artist = song.getArtistName() == null ? "An artist you follow" : song.getArtistName();
        for (String email : emails) {
            EmailRequested request = EmailRequested.newBuilder()
                    .setMeta(EventIds.meta(EventIds.newId(), Instant.now(), Instant.now(), "notification-streams"))
                    .setTo(email)
                    .setKind("NEW_RELEASE")
                    .setSubject(artist + " released " + title)
                    .setBody(artist + " just released \"" + title + "\" on One Melody. Open the app to listen.")
                    .build();
            avro.send(Topics.EMAIL, me.oneorg.melody.streams.notification.Keys.addressKey(email), request);
        }
        log.info("New release {}: queued {} follower emails", song.getSongId(), emails.size());
    }
}
