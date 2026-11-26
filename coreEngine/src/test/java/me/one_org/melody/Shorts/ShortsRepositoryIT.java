package me.one_org.melody.Shorts;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;

import javax.sql.DataSource;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.boot.jdbc.DataSourceBuilder;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

/** Shorts ki SQL queries asli Postgres pe chalata hai (saari Flyway migrations V1-V18 ke saath). */
@Testcontainers(disabledWithoutDocker = true)
class ShortsRepositoryIT {

    @Container
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:17");

    static JdbcClient jdbc;
    static ShortsRepository repo;

    @BeforeAll
    static void migrate() {
        DataSource ds = DataSourceBuilder.create().url(POSTGRES.getJdbcUrl())
                .username(POSTGRES.getUsername()).password(POSTGRES.getPassword()).build();
        Flyway.configure().dataSource(ds).locations("filesystem:../migration/src/main/resources/db/migration").load().migrate();
        jdbc = JdbcClient.create(ds);
        repo = new ShortsRepository(jdbc);
        for (String u : List.of("owner", "fan1", "fan2", "fan3")) {
            jdbc.sql("INSERT INTO users (id, user_name, email) VALUES (:id, :id, :email)")
                    .param("id", u).param("email", u + "@example.com").update();
        }
        jdbc.sql("""
                INSERT INTO songs (id, title, artist_name, duration, song_key, image_key, language, lrclib_id, status, job_id)
                VALUES ('song-1', 'Track', 'Artist', 200, 'songs/song-1', 'img', 'en', 'l', 'ACTIVE', 'j')
                """).update();
    }

    private static void publish(String id, String userId, String publishedAt) {
        repo.insertUpload(id, userId, "shorts-raw/" + id + ".mp4", "caption " + id, "song-1");
        jdbc.sql("UPDATE shorts SET status = 'READY', hls_key = :hls, published_at = CAST(:at AS timestamptz) WHERE id = :id")
                .param("hls", "shorts/" + id + "/master.m3u8").param("at", publishedAt).param("id", id).update();
    }

    @Test
    void uploadLifecycleLikesReportsAndFeedPaging() {
        // Upload -> complete: sirf owner hi UPLOADING ko PROCESSING kar sakta hai, ek hi baar.
        repo.insertUpload("up-1", "owner", "shorts-raw/up-1.mp4", "hi", null);
        assertThat(repo.markProcessing("up-1", "fan1")).isEmpty();
        assertThat(repo.markProcessing("up-1", "owner")).contains("shorts-raw/up-1.mp4");
        assertThat(repo.markProcessing("up-1", "owner")).isEmpty();
        // Abhi publish nahi hua: feed me nahi, like nahi ho sakta.
        assertThat(repo.like("up-1", "fan1")).isEmpty();

        publish("a", "owner", "2026-11-20T10:00:00Z");
        publish("b", "owner", "2026-11-21T10:00:00Z");
        publish("c", "owner", "2026-11-22T10:00:00Z");

        // Latest feed (published_at, id) se pages banata hai, koi repeat nahi.
        List<ShortDtos.Short> first = repo.feed("fan1", ShortsRepository.Sort.LATEST, ShortCursor.START, 2);
        assertThat(first).extracting(ShortDtos.Short::id).containsExactly("c", "b");
        ShortDtos.Short last = first.get(1);
        List<ShortDtos.Short> second = repo.feed("fan1", ShortsRepository.Sort.LATEST,
                ShortCursor.time(last.publishedAt().toInstant(), last.id()), 2);
        assertThat(second).extracting(ShortDtos.Short::id).containsExactly("a");
        assertThat(first.get(0).song().title()).isEqualTo("Track");
        assertThat(first.get(0).owner().userName()).isEqualTo("owner");

        // Ranked feeds chalti hain (SQL sahi hai) aur sirf published shorts deti hain.
        assertThat(repo.feed("fan1", ShortsRepository.Sort.FOR_YOU, ShortCursor.START, 10)).hasSize(3);
        assertThat(repo.feed("fan1", ShortsRepository.Sort.POPULAR, ShortCursor.START, 10)).hasSize(3);

        // Like do baar karo to bhi ek hi ginta hai.
        assertThat(repo.like("a", "fan1")).contains(1L);
        assertThat(repo.like("a", "fan1")).contains(1L);
        assertThat(repo.like("a", "fan2")).contains(2L);
        assertThat(repo.unlike("a", "fan2")).contains(1L);
        assertThat(repo.findById("a", "fan1").orElseThrow().dto().liked()).isTrue();
        assertThat(repo.likedBy("fan1", 0, 10)).extracting(ShortDtos.Short::id).containsExactly("a");

        // Teen alag log report karein to short chhup jaata hai; ek hi banda do baar = ek report.
        assertThat(repo.report("b", "fan1", "SPAM", null, 3)).contains("READY");
        assertThat(repo.report("b", "fan1", "SPAM", null, 3)).contains("READY");
        assertThat(repo.report("b", "fan2", "HATE", null, 3)).contains("READY");
        assertThat(repo.report("b", "fan3", "SPAM", "again", 3)).contains("HIDDEN");
        assertThat(repo.feed("fan1", ShortsRepository.Sort.LATEST, ShortCursor.START, 10))
                .extracting(ShortDtos.Short::id).containsExactly("c", "a");

        // Views sirf published shorts ke ginte hain.
        repo.addViews(Map.of("c", 3L, "b", 5L));
        assertThat(repo.findById("c", "fan1").orElseThrow().dto().viewsCount()).isEqualTo(3);
        assertThat(repo.findById("b", "owner").orElseThrow().dto().viewsCount()).isZero();

        // Owner apna sab dekhta hai (processing aur hidden bhi); baaki sirf published.
        assertThat(repo.byUser("owner", "owner", 0, 10)).hasSize(4);
        assertThat(repo.byUser("owner", "fan1", 0, 10)).hasSize(2);
        assertThat(repo.bySong("song-1", "fan1", 0, 10)).hasSize(2);

        // Delete sirf owner; pichla status lautata hai taaki processing cancel ho sake.
        assertThat(repo.markDeleted("c", "fan1")).isEmpty();
        String[] prev = repo.markDeleted("c", "owner").orElseThrow();
        assertThat(prev[0]).isEqualTo("READY");
        assertThat(prev[1]).isEqualTo("shorts-raw/c.mp4");
        assertThat(repo.findById("c", "owner")).isEmpty();

        // Caption aur song link sirf owner badal sakta hai.
        assertThat(repo.updateOwned("a", "fan1", "x", true, null, false)).isZero();
        assertThat(repo.updateOwned("a", "owner", "new caption", true, null, true)).isEqualTo(1);
        ShortDtos.Short a = repo.findById("a", "owner").orElseThrow().dto();
        assertThat(a.caption()).isEqualTo("new caption");
        assertThat(a.song()).isNull();
    }

    @Test
    void bansAndSongChecks() {
        assertThat(repo.bannedUntil("fan2")).isEmpty();
        jdbc.sql("UPDATE users SET shorts_banned_until = now() + interval '1 day' WHERE id = 'fan2'").update();
        assertThat(repo.bannedUntil("fan2")).isPresent();
        assertThat(repo.songExists("song-1")).isTrue();
        assertThat(repo.songExists("missing")).isFalse();
    }
}
