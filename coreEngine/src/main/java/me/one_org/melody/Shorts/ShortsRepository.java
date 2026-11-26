package me.one_org.melody.Shorts;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * Shorts tables (V18 migration: shorts, short_likes, short_reports) pe seedhi SQL queries (JdbcClient).
 * Jaan-boojh ke JPA nahi: Hibernate start pe har entity ko DB se check karta hai. Agar DB me V18 abhi
 * nahi chali, to JPA se poora core API start hi nahi hota. SQL ke saath sirf ye shorts endpoints fail
 * honge, baaki app chalta rahega.
 */
@Repository
public class ShortsRepository {

    public enum Sort { LATEST, POPULAR, FOR_YOU }

    /** DTO + raw_key aur user_id - ye do cheezein kabhi app tak nahi jaatin. */
    public record Row(ShortDtos.Short dto, String userId, String rawKey) {}

    private static final String SELECT = """
            SELECT s.id, s.caption, s.status, s.hls_key, s.thumbnail_key, s.duration_ms, s.width, s.height,
                   s.likes_count, s.views_count, s.owner_type, s.user_id, s.raw_key, s.failure_reason,
                   s.published_at, s.created_at, u.user_name,
                   so.id AS song_id, so.title AS song_title, so.artist_name AS song_artist,
                   so.image_key AS song_image, so.song_key AS song_key, so.duration AS song_duration,
                   EXISTS (SELECT 1 FROM short_likes l WHERE l.short_id = s.id AND l.user_id = :viewer) AS liked
              FROM shorts s
              LEFT JOIN users u ON u.id = s.user_id
              LEFT JOIN songs so ON so.id = s.song_id
            """;

    /**
     * Popularity score: (likes*3 + views*0.1 + 1) / (ghante_purana + 2)^1.3
     * Time ke saath score ghatta hai ("time decay"), isliye naya popular short purane popular short se upar aata hai.
     */
    private static final String POPULARITY =
            "((s.likes_count * 3 + s.views_count * 0.1 + 1) / power(extract(epoch FROM (now() - s.published_at)) / 3600 + 2, 1.3))";

    /** "For you" boost: short ka gaana viewer ke favourites me hai (+1.5), ya uske followed artist ka hai (+1.0). */
    private static final String PERSONAL_BOOST = """
            (1
             + CASE WHEN s.song_id IN (SELECT f.song_id FROM user_favourite_songs f WHERE f.user_id = :viewer) THEN 1.5 ELSE 0 END
             + CASE WHEN so.artist_name IS NOT NULL AND EXISTS (
                   SELECT 1
                     FROM (SELECT DISTINCT ON (e.artist_id) e.artist_id, e.event_type
                             FROM artist_follow_events e
                            WHERE e.user_id = :viewer
                            ORDER BY e.artist_id, e.created_at DESC) latest
                     JOIN artists a ON a.id = latest.artist_id
                    WHERE latest.event_type = 'FOLLOW'
                      AND LOWER(so.artist_name) LIKE '%' || LOWER(a.name) || '%') THEN 1.0 ELSE 0 END)
            """;

    private final JdbcClient jdbc;

    /** JdbcClient = Spring ka simple SQL chalane wala tool. */
    public ShortsRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** SQL row -> Row (DTO). viewer owner ho tabhi failure reason dikhate hain. */
    private Row map(ResultSet rs, String viewer) throws SQLException {
        String userId = rs.getString("user_id");
        String songId = rs.getString("song_id");
        boolean mine = viewer != null && viewer.equals(userId);
        ShortDtos.LinkedSong song = songId == null ? null : new ShortDtos.LinkedSong(
                songId, rs.getString("song_title"), rs.getString("song_artist"), rs.getString("song_image"),
                rs.getString("song_key"), (Integer) rs.getObject("song_duration"));
        String ownerType = rs.getString("owner_type");
        ShortDtos.Owner owner = new ShortDtos.Owner(ownerType, userId,
                "ADMIN".equals(ownerType) ? "One Melody" : rs.getString("user_name"));
        ShortDtos.Short dto = new ShortDtos.Short(
                rs.getString("id"), rs.getString("caption"), rs.getString("status"),
                rs.getString("hls_key"), rs.getString("thumbnail_key"),
                (Integer) rs.getObject("duration_ms"), (Integer) rs.getObject("width"), (Integer) rs.getObject("height"),
                rs.getLong("likes_count"), rs.getLong("views_count"), rs.getBoolean("liked"), mine,
                owner, song, mine ? rs.getString("failure_reason") : null,
                rs.getObject("published_at", OffsetDateTime.class), rs.getObject("created_at", OffsetDateTime.class));
        return new Row(dto, userId, rs.getString("raw_key"));
    }

    // ---- Padhne wali queries ---------------------------------------------------------------

    /** Feed: latest (time cursor se), popular (POPULARITY), foryou (POPULARITY * PERSONAL_BOOST). Sirf READY shorts. */
    public List<ShortDtos.Short> feed(String viewer, Sort sort, ShortCursor cursor, int limit) {
        String order;
        String where = "WHERE s.status = 'READY'";
        switch (sort) {
            case LATEST -> {
                order = "ORDER BY s.published_at DESC, s.id DESC";
                if (cursor.isTimeCursor()) where += " AND (s.published_at, s.id) < (:cursorTs, :cursorId)";
            }
            case POPULAR -> order = "ORDER BY " + POPULARITY + " DESC, s.id DESC";
            default -> order = "ORDER BY " + POPULARITY + " * " + PERSONAL_BOOST + " DESC, s.id DESC";
        }
        String offset = sort == Sort.LATEST ? "" : " OFFSET :offset";
        var spec = jdbc.sql(SELECT + where + " " + order + " LIMIT :limit" + offset)
                .param("viewer", viewer)
                .param("limit", limit);
        if (sort == Sort.LATEST && cursor.isTimeCursor()) {
            spec = spec.param("cursorTs", Timestamp.from(cursor.publishedAt())).param("cursorId", cursor.id());
        }
        if (sort != Sort.LATEST) spec = spec.param("offset", cursor.offset());
        return spec.query((rs, i) -> map(rs, viewer).dto()).list();
    }

    /** Id se short (kisi bhi status me). */
    public Optional<Row> findById(String id, String viewer) {
        return jdbc.sql(SELECT + "WHERE s.id = :id AND s.status <> 'DELETED'")
                .param("id", id).param("viewer", viewer)
                .query((rs, i) -> map(rs, viewer)).optional();
    }

    /** User ke shorts, naye pehle. Owner ko apne processing / failed / hidden shorts bhi dikhte hain. */
    public List<ShortDtos.Short> byUser(String userId, String viewer, int offset, int limit) {
        String statuses = userId.equals(viewer) ? "s.status <> 'DELETED'" : "s.status = 'READY'";
        return jdbc.sql(SELECT + "WHERE s.user_id = :userId AND " + statuses
                        + " ORDER BY s.created_at DESC, s.id DESC LIMIT :limit OFFSET :offset")
                .param("userId", userId).param("viewer", viewer).param("limit", limit).param("offset", offset)
                .query((rs, i) -> map(rs, viewer).dto()).list();
    }

    /** Is gaane wale READY shorts, naye pehle. */
    public List<ShortDtos.Short> bySong(String songId, String viewer, int offset, int limit) {
        return jdbc.sql(SELECT + "WHERE s.song_id = :songId AND s.status = 'READY' ORDER BY " + POPULARITY
                        + " DESC, s.id DESC LIMIT :limit OFFSET :offset")
                .param("songId", songId).param("viewer", viewer).param("limit", limit).param("offset", offset)
                .query((rs, i) -> map(rs, viewer).dto()).list();
    }

    /** User ke liked shorts, haal me like kiye pehle. */
    public List<ShortDtos.Short> likedBy(String userId, int offset, int limit) {
        return jdbc.sql(SELECT + "JOIN short_likes lk ON lk.short_id = s.id AND lk.user_id = :viewer "
                        + "WHERE s.status = 'READY' ORDER BY lk.created_at DESC, s.id DESC LIMIT :limit OFFSET :offset")
                .param("viewer", userId).param("limit", limit).param("offset", offset)
                .query((rs, i) -> map(rs, userId).dto()).list();
    }

    /** User shorts post karne se kab tak banned hai (admin set karta hai). */
    public Optional<OffsetDateTime> bannedUntil(String userId) {
        return jdbc.sql("SELECT shorts_banned_until FROM users WHERE id = :id")
                .param("id", userId)
                .query((rs, i) -> Optional.ofNullable(rs.getObject(1, OffsetDateTime.class)))
                .optional().flatMap(o -> o);
    }

    /** Ye song hai? */
    public boolean songExists(String songId) {
        return jdbc.sql("SELECT EXISTS (SELECT 1 FROM songs WHERE id = :id AND status = 'ACTIVE')")
                .param("id", songId).query(Boolean.class).single();
    }

    // ---- Likhne wali queries ---------------------------------------------------------------

    /** Nayi short row, status UPLOADING. */
    public void insertUpload(String id, String userId, String rawKey, String caption, String songId) {
        jdbc.sql("""
                INSERT INTO shorts (id, owner_type, user_id, song_id, caption, status, raw_key)
                VALUES (:id, 'LISTENER', :userId, :songId, :caption, 'UPLOADING', :rawKey)
                """)
                .param("id", id).param("userId", userId).param("songId", songId)
                .param("caption", caption).param("rawKey", rawKey)
                .update();
    }

    /** UPLOADING -> PROCESSING (sirf owner). raw key lautata hai; short uska nahi / UPLOADING nahi to empty. */
    public Optional<String> markProcessing(String id, String userId) {
        return jdbc.sql("""
                UPDATE shorts SET status = 'PROCESSING', updated_at = now()
                 WHERE id = :id AND user_id = :userId AND status = 'UPLOADING'
                RETURNING raw_key
                """).param("id", id).param("userId", userId).query(String.class).optional();
    }

    /** Caption / song update (sirf owner ka, deleted nahi). Kitni rows badlin. */
    public int updateOwned(String id, String userId, String caption, boolean setCaption, String songId, boolean setSong) {
        if (!setCaption && !setSong) return 1;
        StringBuilder sql = new StringBuilder("UPDATE shorts SET updated_at = now()");
        if (setCaption) sql.append(", caption = :caption");
        if (setSong) sql.append(", song_id = :songId");
        sql.append(" WHERE id = :id AND user_id = :userId AND status <> 'DELETED'");
        return jdbc.sql(sql.toString())
                .param("id", id).param("userId", userId).param("caption", caption).param("songId", songId)
                .update();
    }

    /** Owner ka short "soft delete" (row rehti hai, status DELETED). [pichla status, raw key] lautata hai. */
    public Optional<String[]> markDeleted(String id, String userId) {
        return jdbc.sql("""
                WITH prev AS (SELECT id, status FROM shorts WHERE id = :id AND user_id = :userId AND status <> 'DELETED' FOR UPDATE)
                UPDATE shorts s SET status = 'DELETED', updated_at = now()
                  FROM prev WHERE s.id = prev.id
                RETURNING prev.status, s.raw_key
                """).param("id", id).param("userId", userId)
                .query((rs, i) -> new String[] {rs.getString(1), rs.getString(2)}).optional();
    }

    /** READY short ko like (ek user ek hi baar). Naya likes count, ya short available na ho to empty. */
    public Optional<Long> like(String id, String userId) {
        int inserted = jdbc.sql("""
                INSERT INTO short_likes (short_id, user_id)
                SELECT s.id, :userId FROM shorts s WHERE s.id = :id AND s.status = 'READY'
                ON CONFLICT DO NOTHING
                """).param("id", id).param("userId", userId).update();
        return jdbc.sql("UPDATE shorts SET likes_count = likes_count + :n WHERE id = :id AND status = 'READY' RETURNING likes_count")
                .param("n", inserted).param("id", id).query(Long.class).optional();
    }

    /** Like hatao. Naya likes count. */
    public Optional<Long> unlike(String id, String userId) {
        int deleted = jdbc.sql("DELETE FROM short_likes WHERE short_id = :id AND user_id = :userId")
                .param("id", id).param("userId", userId).update();
        return jdbc.sql("UPDATE shorts SET likes_count = GREATEST(0, likes_count - :n) WHERE id = :id AND status <> 'DELETED' RETURNING likes_count")
                .param("n", deleted).param("id", id).query(Long.class).optional();
    }

    /**
     * Report likho (ek user ka ek report). Bina resolve hue reports threshold (3) tak pahunche to
     * short HIDDEN ho jaata hai jab tak admin check na kare. Short ka status lautata hai;
     * short hai hi nahi / deleted / published nahi to empty.
     */
    public Optional<String> report(String id, String reporterId, String reason, String note, int autoHideAt) {
        int inserted = jdbc.sql("""
                INSERT INTO short_reports (short_id, reporter_id, reason, note)
                SELECT s.id, :reporter, :reason, :note FROM shorts s WHERE s.id = :id AND s.status IN ('READY', 'HIDDEN')
                ON CONFLICT (short_id, reporter_id) DO NOTHING
                """).param("id", id).param("reporter", reporterId).param("reason", reason).param("note", note).update();
        return jdbc.sql("""
                UPDATE shorts s
                   SET reports_count = s.reports_count + :n,
                       status = CASE WHEN s.status = 'READY'
                                      AND (SELECT count(*) FROM short_reports r WHERE r.short_id = s.id AND NOT r.resolved) >= :limit
                                     THEN 'HIDDEN' ELSE s.status END,
                       hidden_reason = CASE WHEN s.status = 'READY'
                                      AND (SELECT count(*) FROM short_reports r WHERE r.short_id = s.id AND NOT r.resolved) >= :limit
                                     THEN 'Auto-hidden after reports, pending review' ELSE s.hidden_reason END,
                       updated_at = now()
                 WHERE s.id = :id AND s.status IN ('READY', 'HIDDEN')
                RETURNING s.status
                """).param("n", inserted).param("limit", autoHideAt).param("id", id).query(String.class).optional();
    }

    /** Views count badhao: har short ke liye ek UPDATE. */
    public void addViews(Map<String, Long> viewsByShort) {
        viewsByShort.forEach((id, n) -> jdbc.sql(
                        "UPDATE shorts SET views_count = views_count + :n WHERE id = :id AND status = 'READY'")
                .param("n", n).param("id", id).update());
    }
}
