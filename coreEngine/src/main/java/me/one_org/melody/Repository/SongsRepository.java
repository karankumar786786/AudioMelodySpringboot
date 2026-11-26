package me.one_org.melody.Repository;

import me.one_org.melody.Entity.Song;
import me.one_org.melody.Enums.StatusEnum;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

/**
 * Table songs ke liye saari queries: list, search, trending, featured, videos, radio fallback, delete.
 *
 * Repository = database se baat karne wali layer. Spring Data JPA in interfaces ka code khud bana deta hai:
 * method ka naam (findByStatus) ya @Query likho, SQL Spring chala dega.
 * @EntityGraph(songMetadata) = song ke saath streams count bhi ek hi query me laao.
 * "ACTIVE" = sirf wo songs jo publish ho chuke hain (blocked/deleted nahi).
 *
 * TRENDING SCORE: SUM(part + 50) + (alag alag listeners) * 200.
 * Yaani har play ko points milte hain (jitna zyada suna utne zyada), aur jitne zyada alag log sunein
 * utna bada bonus - taaki ek hi banda baar baar sun ke gaana trending na bana sake.
 */
public interface SongsRepository extends JpaRepository<Song, String> {

    /** Id se song, streams count ke saath. */
    @Override
    @EntityGraph(attributePaths = {"songMetadata"})
    Optional<Song> findById(String id);

    /** Kisi status ke saare songs. */
    @EntityGraph(attributePaths = {"songMetadata"})
    List<Song> findByStatus(StatusEnum status);

    /** Saare songs, naye pehle. */
    @EntityGraph(attributePaths = {"songMetadata"})
    @Query("SELECT s FROM Song s ORDER BY s.createdAt DESC")
    List<Song> findAllPaginatedQuery(Pageable pageable);

    /** Page number + size se songs. */
    default List<Song> findAllPaginated(int page, int size) {
        return findAllPaginatedQuery(PageRequest.of(page, size));
    }

    /** Title / artist / album / country me search text dhoondo, naye pehle. */
    @EntityGraph(attributePaths = {"songMetadata"})
    @Query("SELECT s FROM Song s WHERE LOWER(s.title) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "OR LOWER(s.artistName) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "OR LOWER(s.album) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "OR LOWER(s.country) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "ORDER BY s.createdAt DESC")
    List<Song> findAllPaginatedWithSearch(@Param("search") String search, Pageable pageable);

    /** Search text ho to search karo, warna normal list. */
    default List<Song> findAllPaginated(int page, int size, String search) {
        if (search == null || search.trim().isEmpty()) {
            return findAllPaginated(page, size);
        }
        return findAllPaginatedWithSearch(search.trim(), PageRequest.of(page, size));
    }

    /** Search se kitne songs milte hain. */
    @Query("SELECT COUNT(s) FROM Song s WHERE LOWER(s.title) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "OR LOWER(s.artistName) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "OR LOWER(s.album) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "OR LOWER(s.country) LIKE LOWER(CONCAT('%', :search, '%'))")
    long countSongsWithSearch(@Param("search") String search);

    /** Kul songs (ya search ke hisaab se). */
    default long countSongs(String search) {
        if (search == null || search.trim().isEmpty()) {
            return count();
        }
        return countSongsWithSearch(search.trim());
    }

    /** Since ke baad ke plays se trending song ids (score upar class doc me). */
    @Query("SELECT h.song.id FROM UserHistory h " +
           "WHERE h.song.status = me.one_org.melody.Enums.StatusEnum.ACTIVE " +
           "AND h.listenedAt >= :since " +
           "GROUP BY h.song.id " +
           "ORDER BY (SUM(h.part + 50) + COUNT(DISTINCT h.user.id) * 200) DESC")
    List<String> findTrendingSongIdsSince(
            @Param("since") LocalDateTime since,
            Pageable pageable);

    /** Ab tak ke saare plays se trending song ids. */
    @Query("SELECT h.song.id FROM UserHistory h " +
           "WHERE h.song.status = me.one_org.melody.Enums.StatusEnum.ACTIVE " +
           "GROUP BY h.song.id " +
           "ORDER BY (SUM(h.part + 50) + COUNT(DISTINCT h.user.id) * 200) DESC")
    List<String> findTrendingSongIdsAllTime(Pageable pageable);

    /** Since ke baad, ek genre ke trending song ids. */
    @Query("SELECT h.song.id FROM UserHistory h " +
           "WHERE h.song.status = me.one_org.melody.Enums.StatusEnum.ACTIVE " +
           "AND h.listenedAt >= :since " +
           "AND LOWER(h.song.genre) = LOWER(:genre) " +
           "GROUP BY h.song.id " +
           "ORDER BY (SUM(h.part + 50) + COUNT(DISTINCT h.user.id) * 200) DESC")
    List<String> findTrendingSongIdsSinceAndGenre(
            @Param("since") LocalDateTime since,
            @Param("genre") String genre,
            Pageable pageable);

    /** All-time, ek genre ke trending song ids. */
    @Query("SELECT h.song.id FROM UserHistory h " +
           "WHERE h.song.status = me.one_org.melody.Enums.StatusEnum.ACTIVE " +
           "AND LOWER(h.song.genre) = LOWER(:genre) " +
           "GROUP BY h.song.id " +
           "ORDER BY (SUM(h.part + 50) + COUNT(DISTINCT h.user.id) * 200) DESC")
    List<String> findTrendingSongIdsAllTimeAndGenre(
            @Param("genre") String genre,
            Pageable pageable);

    /** All-time trending ids. */
    default List<String> findTrendingSongIds(Pageable pageable) {
        return findTrendingSongIdsAllTime(pageable);
    }

    /**
     * Trending songs, trending wale order me hi.
     * findByIdIn order nahi rakhta, isliye map bana ke ids ke order me wapas lagate hain.
     */
    default List<Song> findTrendingSongs(Pageable pageable) {
        List<String> trendingIds = findTrendingSongIds(pageable);
        if (trendingIds.isEmpty()) return List.of();
        java.util.Map<String, Song> songMap = findByIdIn(trendingIds).stream()
                .collect(java.util.stream.Collectors.toMap(Song::getId, s -> s));
        List<Song> songs = new ArrayList<>();
        for (String id : trendingIds) {
            Song s = songMap.get(id);
            if (s != null) songs.add(s);
        }
        return songs;
    }

    /** Sabse zyada streams wale active songs. */
    @EntityGraph(attributePaths = {"songMetadata"})
    @Query("SELECT s FROM Song s " +
           "LEFT JOIN s.songMetadata sm " +
           "WHERE s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE " +
           "ORDER BY COALESCE(sm.totalStreams, 0) DESC, s.createdAt DESC")
    List<Song> findPopularActiveSongs(Pageable pageable);

    /** Popular songs, par in ids ko chhod ke (duplicates se bachne ke liye). */
    @EntityGraph(attributePaths = {"songMetadata"})
    @Query("SELECT s FROM Song s " +
           "LEFT JOIN s.songMetadata sm " +
           "WHERE s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE " +
           "AND s.id NOT IN :existingIds " +
           "ORDER BY COALESCE(sm.totalStreams, 0) DESC, s.createdAt DESC")
    List<Song> findPopularActiveSongsExcluding(
            @Param("existingIds") List<String> existingIds,
            Pageable pageable);

    /** Ek genre ke popular songs. */
    @EntityGraph(attributePaths = {"songMetadata"})
    @Query("SELECT s FROM Song s " +
           "LEFT JOIN s.songMetadata sm " +
           "WHERE s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE " +
           "AND LOWER(s.genre) = LOWER(:genre) " +
           "ORDER BY COALESCE(sm.totalStreams, 0) DESC, s.createdAt DESC")
    List<Song> findPopularActiveSongsByGenre(
            @Param("genre") String genre,
            Pageable pageable);

    /** Ek genre ke popular songs, in ids ko chhod ke. */
    @EntityGraph(attributePaths = {"songMetadata"})
    @Query("SELECT s FROM Song s " +
           "LEFT JOIN s.songMetadata sm " +
           "WHERE s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE " +
           "AND s.id NOT IN :existingIds " +
           "AND LOWER(s.genre) = LOWER(:genre) " +
           "ORDER BY COALESCE(sm.totalStreams, 0) DESC, s.createdAt DESC")
    List<Song> findPopularActiveSongsExcludingByGenre(
            @Param("existingIds") List<String> existingIds,
            @Param("genre") String genre,
            Pageable pageable);

    /** Naye active songs. */
    @EntityGraph(attributePaths = {"songMetadata"})
    @Query("SELECT s FROM Song s WHERE s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE ORDER BY s.createdAt DESC")
    List<Song> findActiveSongs(Pageable pageable);

    /** Naye active songs, in ids ko chhod ke. */
    @EntityGraph(attributePaths = {"songMetadata"})
    @Query("SELECT s FROM Song s WHERE s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE AND s.id NOT IN :existingIds ORDER BY s.createdAt DESC")
    List<Song> findActiveSongsExcluding(@Param("existingIds") List<String> existingIds, Pageable pageable);

    /**
     * Trending list banata hai, aur kam pade to bharta hai:
     * 1. window (24h / 7d / 30d / all) aur genre ke hisaab se trending.
     * 2. Chhoti window me koi play na ho to all-time trending.
     * 3. Phir bhi kam ho to popular songs (streams se).
     * 4. Phir bhi kam ho to naye active songs.
     * limit 1 se 50 ke beech rakha jaata hai. language abhi use nahi hota.
     */
    default List<Song> findTrending(int limit, String window, String genre, String language) {
        int safeLimit = Math.max(1, Math.min(50, limit));
        String cleanGenre = (genre != null && !genre.trim().isBlank()) ? genre.trim().toLowerCase() : null;

        LocalDateTime since = resolveWindowCutoff(window);

        List<String> trendingIds;
        if (cleanGenre != null) {
            trendingIds = (since != null)
                    ? findTrendingSongIdsSinceAndGenre(since, cleanGenre, PageRequest.of(0, safeLimit))
                    : findTrendingSongIdsAllTimeAndGenre(cleanGenre, PageRequest.of(0, safeLimit));
        } else {
            trendingIds = (since != null)
                    ? findTrendingSongIdsSince(since, PageRequest.of(0, safeLimit))
                    : findTrendingSongIdsAllTime(PageRequest.of(0, safeLimit));
        }

        // Chhoti window (jaise 24h) me ek bhi play na ho to pehle all-time trending try karo
        if ((trendingIds == null || trendingIds.isEmpty()) && since != null) {
            trendingIds = (cleanGenre != null)
                    ? findTrendingSongIdsAllTimeAndGenre(cleanGenre, PageRequest.of(0, safeLimit))
                    : findTrendingSongIdsAllTime(PageRequest.of(0, safeLimit));
        }

        List<Song> songs = new ArrayList<>();
        if (trendingIds != null && !trendingIds.isEmpty()) {
            java.util.Map<String, Song> songMap = findByIdIn(trendingIds).stream()
                    .collect(java.util.stream.Collectors.toMap(Song::getId, s -> s));
            for (String id : trendingIds) {
                Song s = songMap.get(id);
                if (s != null) songs.add(s);
            }
        }

        if (songs.size() < safeLimit) {
            int remaining = safeLimit - songs.size();
            List<String> existingIds = songs.stream().map(Song::getId).toList();
            List<Song> fallback;
            if (cleanGenre != null) {
                fallback = existingIds.isEmpty()
                        ? findPopularActiveSongsByGenre(cleanGenre, PageRequest.of(0, remaining))
                        : findPopularActiveSongsExcludingByGenre(existingIds, cleanGenre, PageRequest.of(0, remaining));
            } else {
                fallback = existingIds.isEmpty()
                        ? findPopularActiveSongs(PageRequest.of(0, remaining))
                        : findPopularActiveSongsExcluding(existingIds, PageRequest.of(0, remaining));
            }
            if (fallback != null && !fallback.isEmpty()) {
                songs.addAll(fallback);
            }

            // Ab bhi kam hain (jaise chhota genre) to koi bhi naye active songs se bharo
            if (songs.size() < safeLimit) {
                int stillRemaining = safeLimit - songs.size();
                List<String> currentIds = songs.stream().map(Song::getId).toList();
                List<Song> generalFallback = currentIds.isEmpty()
                        ? findActiveSongs(PageRequest.of(0, stillRemaining))
                        : findActiveSongsExcluding(currentIds, PageRequest.of(0, stillRemaining));
                if (generalFallback != null && !generalFallback.isEmpty()) {
                    songs.addAll(generalFallback);
                }
            }
        }

        return songs;
    }

    /** 7 din ka trending, bina filter. */
    default List<Song> findTrending(int limit) {
        return findTrending(limit, "7d", null, null);
    }

    /** Window ka naam -> kab se ginna hai. "all" pe null (matlab koi limit nahi). Galat value pe 7 din. */
    static LocalDateTime resolveWindowCutoff(String window) {
        if (window == null || window.trim().isBlank()) {
            return LocalDateTime.now().minusDays(7);
        }
        return switch (window.toLowerCase().trim()) {
            case "day", "24h", "today", "1d" -> LocalDateTime.now().minusHours(24);
            case "week", "7d", "weekly" -> LocalDateTime.now().minusDays(7);
            case "month", "30d", "monthly" -> LocalDateTime.now().minusDays(30);
            case "all", "alltime", "all-time" -> null;
            default -> LocalDateTime.now().minusDays(7);
        };
    }

    /** Admin ke featured kiye songs. */
    @EntityGraph(attributePaths = {"songMetadata"})
    @Query("SELECT s FROM Song s WHERE s.isFeatured = true AND s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE ORDER BY s.createdAt DESC")
    List<Song> findFeatured();

    /** Jin songs ka full music video hai. */
    @EntityGraph(attributePaths = {"songMetadata"})
    @Query("SELECT s FROM Song s WHERE (s.fullVideoKey IS NOT NULL AND TRIM(s.fullVideoKey) <> '') AND s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE ORDER BY s.createdAt DESC")
    List<Song> findSongsWithVideo(Pageable pageable);

    /** Upar wala, limit ke saath. */
    default List<Song> findSongsWithVideo(int limit) {
        return findSongsWithVideo(PageRequest.of(0, limit));
    }

    /** Naye music videos; genre / language filter optional (null = sab). */
    @EntityGraph(attributePaths = {"songMetadata"})
    @Query("SELECT s FROM Song s WHERE (s.fullVideoKey IS NOT NULL AND TRIM(s.fullVideoKey) <> '') " +
           "AND s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE " +
           "AND (:genre IS NULL OR LOWER(s.genre) = LOWER(:genre) OR LOWER(s.genre) LIKE LOWER(CONCAT('%', :genre, '%'))) " +
           "AND (:language IS NULL OR LOWER(s.language) = LOWER(:language)) " +
           "ORDER BY s.createdAt DESC")
    List<Song> findVideosLatest(@Param("genre") String genre, @Param("language") String language, Pageable pageable);

    /** Filter ke hisaab se kitne videos. */
    @Query("SELECT COUNT(s) FROM Song s WHERE (s.fullVideoKey IS NOT NULL AND TRIM(s.fullVideoKey) <> '') " +
           "AND s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE " +
           "AND (:genre IS NULL OR LOWER(s.genre) = LOWER(:genre) OR LOWER(s.genre) LIKE LOWER(CONCAT('%', :genre, '%'))) " +
           "AND (:language IS NULL OR LOWER(s.language) = LOWER(:language))")
    long countVideos(@Param("genre") String genre, @Param("language") String language);

    /** PURANA canvas feed: jin songs ka canvas loop (videoKey) hai, naye pehle. */
    @EntityGraph(attributePaths = {"songMetadata"})
    @Query("SELECT s FROM Song s WHERE (s.videoKey IS NOT NULL AND TRIM(s.videoKey) <> '') " +
           "AND s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE " +
           "ORDER BY s.createdAt DESC")
    List<Song> findCanvasSongsLatest(Pageable pageable);

    /** Upar wala, ek genre ka. */
    @EntityGraph(attributePaths = {"songMetadata"})
    @Query("SELECT s FROM Song s WHERE (s.videoKey IS NOT NULL AND TRIM(s.videoKey) <> '') " +
           "AND s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE " +
           "AND (LOWER(s.genre) = LOWER(:genre) OR LOWER(s.genre) LIKE LOWER(CONCAT('%', :genre, '%'))) " +
           "ORDER BY s.createdAt DESC")
    List<Song> findCanvasSongsLatestByGenre(@Param("genre") String genre, Pageable pageable);

    /** PURANA canvas feed: sabse zyada likes, phir streams. */
    @EntityGraph(attributePaths = {"songMetadata"})
    @Query("SELECT s FROM Song s LEFT JOIN s.songMetadata sm " +
           "WHERE (s.videoKey IS NOT NULL AND TRIM(s.videoKey) <> '') " +
           "AND s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE " +
           "ORDER BY (SELECT COUNT(usl) FROM UserShortsLike usl WHERE usl.song = s) DESC, COALESCE(sm.totalStreams, 0) DESC, s.createdAt DESC")
    List<Song> findCanvasSongsPopular(Pageable pageable);

    /** Upar wala, ek genre ka. */
    @EntityGraph(attributePaths = {"songMetadata"})
    @Query("SELECT s FROM Song s LEFT JOIN s.songMetadata sm " +
           "WHERE (s.videoKey IS NOT NULL AND TRIM(s.videoKey) <> '') " +
           "AND s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE " +
           "AND (LOWER(s.genre) = LOWER(:genre) OR LOWER(s.genre) LIKE LOWER(CONCAT('%', :genre, '%'))) " +
           "ORDER BY (SELECT COUNT(usl) FROM UserShortsLike usl WHERE usl.song = s) DESC, COALESCE(sm.totalStreams, 0) DESC, s.createdAt DESC")
    List<Song> findCanvasSongsPopularByGenre(@Param("genre") String genre, Pageable pageable);

    /** PURANA canvas feed: random order. */
    @EntityGraph(attributePaths = {"songMetadata"})
    @Query("SELECT s FROM Song s WHERE (s.videoKey IS NOT NULL AND TRIM(s.videoKey) <> '') " +
           "AND s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE " +
           "ORDER BY function('random')")
    List<Song> findCanvasSongsRandom(Pageable pageable);

    /** Upar wala, ek genre ka. */
    @EntityGraph(attributePaths = {"songMetadata"})
    @Query("SELECT s FROM Song s WHERE (s.videoKey IS NOT NULL AND TRIM(s.videoKey) <> '') " +
           "AND s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE " +
           "AND (LOWER(s.genre) = LOWER(:genre) OR LOWER(s.genre) LIKE LOWER(CONCAT('%', :genre, '%'))) " +
           "ORDER BY function('random')")
    List<Song> findCanvasSongsRandomByGenre(@Param("genre") String genre, Pageable pageable);

    /** Kitne songs ka canvas loop hai. */
    @Query("SELECT COUNT(s) FROM Song s WHERE (s.videoKey IS NOT NULL AND TRIM(s.videoKey) <> '') " +
           "AND s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE")
    long countCanvasSongs();

    /** Ek genre me kitne canvas songs. */
    @Query("SELECT COUNT(s) FROM Song s WHERE (s.videoKey IS NOT NULL AND TRIM(s.videoKey) <> '') " +
           "AND s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE " +
           "AND (LOWER(s.genre) = LOWER(:genre) OR LOWER(s.genre) LIKE LOWER(CONCAT('%', :genre, '%')))")
    long countCanvasSongsByGenre(@Param("genre") String genre);

    /** Sabse zyada streams wale videos; genre / language optional. */
    @EntityGraph(attributePaths = {"songMetadata"})
    @Query("SELECT s FROM Song s LEFT JOIN s.songMetadata sm " +
           "WHERE (s.fullVideoKey IS NOT NULL AND TRIM(s.fullVideoKey) <> '') " +
           "AND s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE " +
           "AND (:genre IS NULL OR LOWER(s.genre) = LOWER(:genre) OR LOWER(s.genre) LIKE LOWER(CONCAT('%', :genre, '%'))) " +
           "AND (:language IS NULL OR LOWER(s.language) = LOWER(:language)) " +
           "ORDER BY COALESCE(sm.totalStreams, 0) DESC, s.createdAt DESC")
    List<Song> findVideosPopular(@Param("genre") String genre, @Param("language") String language, Pageable pageable);

    /** Ek artist ke videos. */
    @EntityGraph(attributePaths = {"songMetadata"})
    @Query("SELECT s FROM Song s WHERE (s.fullVideoKey IS NOT NULL AND TRIM(s.fullVideoKey) <> '') " +
           "AND s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE " +
           "AND (LOWER(s.artistName) = LOWER(:artistName) OR LOWER(s.artistName) LIKE LOWER(CONCAT('%', :artistName, '%'))) " +
           "ORDER BY s.createdAt DESC")
    List<Song> findVideosByArtist(@Param("artistName") String artistName, Pageable pageable);

    /** Ek artist ke kitne videos. */
    @Query("SELECT COUNT(s) FROM Song s WHERE (s.fullVideoKey IS NOT NULL AND TRIM(s.fullVideoKey) <> '') " +
           "AND s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE " +
           "AND (LOWER(s.artistName) = LOWER(:artistName) OR LOWER(s.artistName) LIKE LOWER(CONCAT('%', :artistName, '%')))")
    long countVideosByArtist(@Param("artistName") String artistName);

    /** Since ke baad ke trending videos (same score). */
    @Query("SELECT h.song.id FROM UserHistory h " +
           "WHERE h.song.status = me.one_org.melody.Enums.StatusEnum.ACTIVE " +
           "AND (h.song.fullVideoKey IS NOT NULL AND TRIM(h.song.fullVideoKey) <> '') " +
           "AND h.listenedAt >= :since " +
           "GROUP BY h.song.id " +
           "ORDER BY (SUM(h.part + 50) + COUNT(DISTINCT h.user.id) * 200) DESC")
    List<String> findTrendingVideoIdsSince(@Param("since") LocalDateTime since, Pageable pageable);

    /** All-time trending videos. */
    @Query("SELECT h.song.id FROM UserHistory h " +
           "WHERE h.song.status = me.one_org.melody.Enums.StatusEnum.ACTIVE " +
           "AND (h.song.fullVideoKey IS NOT NULL AND TRIM(h.song.fullVideoKey) <> '') " +
           "GROUP BY h.song.id " +
           "ORDER BY (SUM(h.part + 50) + COUNT(DISTINCT h.user.id) * 200) DESC")
    List<String> findTrendingVideoIdsAllTime(Pageable pageable);

    /** Since ke baad, ek genre ke trending videos. */
    @Query("SELECT h.song.id FROM UserHistory h " +
           "WHERE h.song.status = me.one_org.melody.Enums.StatusEnum.ACTIVE " +
           "AND (h.song.fullVideoKey IS NOT NULL AND TRIM(h.song.fullVideoKey) <> '') " +
           "AND h.listenedAt >= :since " +
           "AND (LOWER(h.song.genre) = LOWER(:genre) OR LOWER(h.song.genre) LIKE LOWER(CONCAT('%', :genre, '%'))) " +
           "GROUP BY h.song.id " +
           "ORDER BY (SUM(h.part + 50) + COUNT(DISTINCT h.user.id) * 200) DESC")
    List<String> findTrendingVideoIdsSinceAndGenre(@Param("since") LocalDateTime since, @Param("genre") String genre, Pageable pageable);

    /** All-time, ek genre ke trending videos. */
    @Query("SELECT h.song.id FROM UserHistory h " +
           "WHERE h.song.status = me.one_org.melody.Enums.StatusEnum.ACTIVE " +
           "AND (h.song.fullVideoKey IS NOT NULL AND TRIM(h.song.fullVideoKey) <> '') " +
           "AND (LOWER(h.song.genre) = LOWER(:genre) OR LOWER(h.song.genre) LIKE LOWER(CONCAT('%', :genre, '%'))) " +
           "GROUP BY h.song.id " +
           "ORDER BY (SUM(h.part + 50) + COUNT(DISTINCT h.user.id) * 200) DESC")
    List<String> findTrendingVideoIdsAllTimeAndGenre(@Param("genre") String genre, Pageable pageable);

    /** Artist ke videos, in ids ko chhod ke. */
    @EntityGraph(attributePaths = {"songMetadata"})
    @Query("SELECT s FROM Song s WHERE (s.fullVideoKey IS NOT NULL AND TRIM(s.fullVideoKey) <> '') " +
           "AND s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE " +
           "AND s.id NOT IN :excluded " +
           "AND (LOWER(s.artistName) = LOWER(:artistName) OR LOWER(s.artistName) LIKE LOWER(CONCAT('%', :artistName, '%'))) " +
           "ORDER BY s.createdAt DESC")
    List<Song> findActiveVideosByArtistExcluding(@Param("artistName") String artistName, @Param("excluded") List<String> excluded, Pageable pageable);

    /** Genre ke videos, in ids ko chhod ke. */
    @EntityGraph(attributePaths = {"songMetadata"})
    @Query("SELECT s FROM Song s WHERE (s.fullVideoKey IS NOT NULL AND TRIM(s.fullVideoKey) <> '') " +
           "AND s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE " +
           "AND s.id NOT IN :excluded " +
           "AND (LOWER(s.genre) = LOWER(:genre) OR LOWER(s.genre) LIKE LOWER(CONCAT('%', :genre, '%'))) " +
           "ORDER BY s.createdAt DESC")
    List<Song> findActiveVideosByGenreExcluding(@Param("genre") String genre, @Param("excluded") List<String> excluded, Pageable pageable);

    /** Popular videos, in ids ko chhod ke. */
    @EntityGraph(attributePaths = {"songMetadata"})
    @Query("SELECT s FROM Song s LEFT JOIN s.songMetadata sm " +
           "WHERE (s.fullVideoKey IS NOT NULL AND TRIM(s.fullVideoKey) <> '') " +
           "AND s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE " +
           "AND s.id NOT IN :excluded " +
           "ORDER BY COALESCE(sm.totalStreams, 0) DESC, s.createdAt DESC")
    List<Song> findActiveVideosExcluding(@Param("excluded") List<String> excluded, Pageable pageable);

    /**
     * Trending videos - findTrending jaisa hi:
     * trending -> (khaali ho to) all-time -> kam pade to popular videos se bharo.
     * Language diya ho to sirf usi language ke trending videos rakhte hain.
     */
    default List<Song> findTrendingVideos(int limit, String window, String genre, String language) {
        int safeLimit = Math.max(1, Math.min(50, limit));
        String cleanGenre = (genre != null && !genre.trim().isBlank()) ? genre.trim().toLowerCase() : null;
        String cleanLanguage = (language != null && !language.trim().isBlank()) ? language.trim().toLowerCase() : null;
        LocalDateTime since = resolveWindowCutoff(window);

        List<String> trendingIds;
        if (cleanGenre != null) {
            trendingIds = (since != null)
                    ? findTrendingVideoIdsSinceAndGenre(since, cleanGenre, PageRequest.of(0, safeLimit))
                    : findTrendingVideoIdsAllTimeAndGenre(cleanGenre, PageRequest.of(0, safeLimit));
        } else {
            trendingIds = (since != null)
                    ? findTrendingVideoIdsSince(since, PageRequest.of(0, safeLimit))
                    : findTrendingVideoIdsAllTime(PageRequest.of(0, safeLimit));
        }

        if ((trendingIds == null || trendingIds.isEmpty()) && since != null) {
            trendingIds = (cleanGenre != null)
                    ? findTrendingVideoIdsAllTimeAndGenre(cleanGenre, PageRequest.of(0, safeLimit))
                    : findTrendingVideoIdsAllTime(PageRequest.of(0, safeLimit));
        }

        List<Song> videos = new ArrayList<>();
        if (trendingIds != null && !trendingIds.isEmpty()) {
            java.util.Map<String, Song> songMap = findByIdIn(trendingIds).stream()
                    .collect(java.util.stream.Collectors.toMap(Song::getId, s -> s));
            for (String id : trendingIds) {
                Song s = songMap.get(id);
                boolean hasVideo = s != null && (
                        (s.getFullVideoKey() != null && !s.getFullVideoKey().trim().isBlank()) ||
                        (s.getVideoKey() != null && !s.getVideoKey().trim().isBlank())
                );
                if (hasVideo) {
                    if (cleanLanguage == null || (s != null && s.getLanguage() != null && s.getLanguage().equalsIgnoreCase(cleanLanguage))) {
                        videos.add(s);
                    }
                }
            }
        }

        if (videos.size() < safeLimit) {
            int remaining = safeLimit - videos.size();
            List<String> existingIds = videos.stream().map(Song::getId).toList();
            List<Song> fallback = existingIds.isEmpty()
                    ? findVideosPopular(cleanGenre, cleanLanguage, PageRequest.of(0, remaining))
                    : findActiveVideosExcluding(existingIds, PageRequest.of(0, remaining));
            if (fallback != null && !fallback.isEmpty()) {
                videos.addAll(fallback);
            }
        }

        return videos;
    }

    /**
     * Ek video ke neeche "related videos":
     * 1. Same artist ke ("A ft. B" ko A aur B me tod ke dono ke)
     * 2. Same genre ke
     * 3. Phir bhi kam pade to popular videos
     * Jo video ek baar aa gaya use excluded me daal dete hain, taaki dobara na aaye.
     */
    default List<Song> findRelatedVideos(String songId, String artistName, String genre, int limit) {
        int safeLimit = Math.max(1, Math.min(30, limit));
        List<Song> results = new ArrayList<>();
        List<String> excluded = new ArrayList<>();
        if (songId != null && !songId.isBlank()) {
            excluded.add(songId);
        }

        // 1. Same artist ke videos ("A ft. B" ko alag alag artists me todte hain)
        if (artistName != null && !artistName.isBlank() && results.size() < safeLimit) {
            List<String> artistTokens = Arrays.stream(artistName.split("[,/&]|\\b(?:ft|feat)(?:\\.|\\b)"))
                    .map(s -> s.replaceAll("^[.\\s]+|[.\\s]+$", "").trim())
                    .filter(s -> !s.isBlank())
                    .distinct()
                    .toList();
            for (String singleArtist : artistTokens) {
                if (results.size() >= safeLimit) break;
                int needed = safeLimit - results.size();
                List<Song> artistMatches = excluded.isEmpty()
                        ? findVideosByArtist(singleArtist, PageRequest.of(0, needed))
                        : findActiveVideosByArtistExcluding(singleArtist, excluded, PageRequest.of(0, needed));
                for (Song s : artistMatches) {
                    results.add(s);
                    excluded.add(s.getId());
                    if (results.size() >= safeLimit) break;
                }
            }
        }

        // 2. Same genre ke videos (comma se alag genres)
        if (genre != null && !genre.isBlank() && results.size() < safeLimit) {
            List<String> genreTokens = Arrays.stream(genre.split(","))
                    .map(String::trim)
                    .filter(s -> !s.isBlank())
                    .distinct()
                    .toList();
            for (String singleGenre : genreTokens) {
                if (results.size() >= safeLimit) break;
                int needed = safeLimit - results.size();
                List<Song> genreMatches = excluded.isEmpty()
                        ? findVideosPopular(singleGenre, null, PageRequest.of(0, needed))
                        : findActiveVideosByGenreExcluding(singleGenre, excluded, PageRequest.of(0, needed));
                for (Song s : genreMatches) {
                    results.add(s);
                    excluded.add(s.getId());
                    if (results.size() >= safeLimit) break;
                }
            }
        }

        // 3. Phir bhi kam pade to popular videos
        if (results.size() < safeLimit) {
            int needed = safeLimit - results.size();
            List<Song> popularFallback = excluded.isEmpty()
                    ? findVideosPopular(null, null, PageRequest.of(0, needed))
                    : findActiveVideosExcluding(excluded, PageRequest.of(0, needed));
            if (popularFallback != null && !popularFallback.isEmpty()) {
                results.addAll(popularFallback);
            }
        }

        return results;
    }

    /** Kitne featured songs. */
    @Query("SELECT COUNT(s) FROM Song s WHERE s.isFeatured = true AND s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE")
    long countFeatured();

    /** In ids ke saare songs ek query me (order guaranteed nahi). */
    @EntityGraph(attributePaths = {"songMetadata"})
    List<Song> findByIdIn(List<String> ids);

    /** Ids se songs; khaali list pe query nahi. */
    default List<Song> findAllByIds(List<String> ids) {
        if (ids == null || ids.isEmpty()) return List.of();
        return findByIdIn(ids);
    }

    /** Artist ke naam se songs (naam ka hissa bhi chalega). */
    @EntityGraph(attributePaths = {"songMetadata"})
    @Query("SELECT s FROM Song s WHERE s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE AND (LOWER(s.artistName) = LOWER(:artistName) OR LOWER(s.artistName) LIKE LOWER(CONCAT('%', :artistName, '%'))) ORDER BY s.createdAt DESC")
    List<Song> findActiveByArtistName(@Param("artistName") String artistName, Pageable pageable);

    /** Artist ke kitne songs. */
    @Query("SELECT COUNT(s) FROM Song s WHERE s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE AND (LOWER(s.artistName) = LOWER(:artistName) OR LOWER(s.artistName) LIKE LOWER(CONCAT('%', :artistName, '%')))")
    long countActiveByArtistName(@Param("artistName") String artistName);

    /** Artist ke songs, in ids ko chhod ke. */
    @EntityGraph(attributePaths = {"songMetadata"})
    @Query("SELECT s FROM Song s WHERE s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE AND LOWER(s.artistName) = LOWER(:artistName) AND s.id NOT IN :excluded ORDER BY s.createdAt DESC")
    List<Song> findActiveByArtistNameExcluding(@Param("artistName") String artistName, @Param("excluded") List<String> excluded, Pageable pageable);

    /** Ek language ke songs. */
    @EntityGraph(attributePaths = {"songMetadata"})
    @Query("SELECT s FROM Song s WHERE s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE AND LOWER(s.language) = LOWER(:language) ORDER BY s.createdAt DESC")
    List<Song> findActiveByLanguage(@Param("language") String language, Pageable pageable);

    /** Ek language ke songs, in ids ko chhod ke. */
    @EntityGraph(attributePaths = {"songMetadata"})
    @Query("SELECT s FROM Song s WHERE s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE AND LOWER(s.language) = LOWER(:language) AND s.id NOT IN :excluded ORDER BY s.createdAt DESC")
    List<Song> findActiveByLanguageExcluding(@Param("language") String language, @Param("excluded") List<String> excluded, Pageable pageable);

    /**
     * Mood radio ke liye songs: jinki energy aur valence (khushi) diye gaye range me ho.
     * Index idx_songs_active_energy_valence (V15) isko fast banata hai.
     * Jinka tempo pata nahi (null) wo bhi chal jaate hain.
     */
    @EntityGraph(attributePaths = {"songMetadata"})
    @Query("SELECT s FROM Song s WHERE s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE " +
           "AND s.energy BETWEEN :minEnergy AND :maxEnergy " +
           "AND s.valence BETWEEN :minValence AND :maxValence " +
           "AND (s.tempo IS NULL OR s.tempo BETWEEN :minTempo AND :maxTempo) " +
           "ORDER BY s.createdAt DESC")
    List<Song> findActiveByAudioRange(@Param("minEnergy") double minEnergy, @Param("maxEnergy") double maxEnergy,
                                      @Param("minValence") double minValence, @Param("maxValence") double maxValence,
                                      @Param("minTempo") double minTempo, @Param("maxTempo") double maxTempo,
                                      Pageable pageable);

    /** Ek genre ke songs. */
    @EntityGraph(attributePaths = {"songMetadata"})
    @Query("SELECT s FROM Song s WHERE s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE AND (LOWER(s.genre) = LOWER(:genre) OR LOWER(s.genre) LIKE LOWER(CONCAT('%', :genre, '%'))) ORDER BY s.createdAt DESC")
    List<Song> findActiveByGenre(@Param("genre") String genre, Pageable pageable);

    /** Ek genre ke songs, in ids ko chhod ke. */
    @EntityGraph(attributePaths = {"songMetadata"})
    @Query("SELECT s FROM Song s WHERE s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE AND (LOWER(s.genre) = LOWER(:genre) OR LOWER(s.genre) LIKE LOWER(CONCAT('%', :genre, '%'))) AND s.id NOT IN :excluded ORDER BY s.createdAt DESC")
    List<Song> findActiveByGenreExcluding(@Param("genre") String genre, @Param("excluded") List<String> excluded, Pageable pageable);

    /**
     * Recombee kaam na kare tab radio ke liye songs (seed song jaise):
     * 1. Same album / movie (max 3, taaki radio me variety rahe)
     * 2. Same genre(s)
     * 3. Same artist(s)
     * 4. Same language
     * 5. Koi bhi naye active songs
     * Har step ke songs excluded list me jaate hain taaki koi gaana do baar na aaye.
     */
    default List<Song> findRadioFallback(String album, String genre, String artistName, String language, List<String> excludeIds, int limit) {
        List<Song> results = new ArrayList<>();
        List<String> excluded = excludeIds != null ? new ArrayList<>(excludeIds) : new ArrayList<>();

        // 1. Same album / movie - max 3, taaki radio sirf ek album na ban jaaye
        if (album != null && !album.isBlank() && results.size() < limit) {
            int albumCap = Math.min(3, limit);
            int albumAdded = 0;
            List<Song> albumMatches = findByAlbum(album.trim());
            for (Song s : albumMatches) {
                if (!excluded.contains(s.getId())) {
                    results.add(s);
                    excluded.add(s.getId());
                    albumAdded++;
                    if (results.size() >= limit || albumAdded >= albumCap) break;
                }
            }
        }

        // 2. Same genre (genre "Pop, Rock" jaisa ho to dono alag alag)
        if (genre != null && !genre.isBlank() && results.size() < limit) {
            List<String> genreTokens = Arrays.stream(genre.split(","))
                    .map(String::trim)
                    .filter(s -> !s.isBlank())
                    .distinct()
                    .toList();
            for (String singleGenre : genreTokens) {
                if (results.size() >= limit) break;
                int needed = limit - results.size();
                List<Song> genreMatches = excluded.isEmpty()
                        ? findActiveByGenre(singleGenre, PageRequest.of(0, needed))
                        : findActiveByGenreExcluding(singleGenre, excluded, PageRequest.of(0, needed));
                for (Song s : genreMatches) {
                    results.add(s);
                    excluded.add(s.getId());
                    if (results.size() >= limit) break;
                }
            }
        }

        // 3. Same artist ("A, B" / "A & B" / "A ft. B" sab tod ke)
        if (artistName != null && !artistName.isBlank() && results.size() < limit) {
            List<String> artistTokens = Arrays.stream(artistName.split("[,/&]|\\b(?:ft|feat)(?:\\.|\\b)"))
                    .map(s -> s.replaceAll("^[.\\s]+|[.\\s]+$", "").trim())
                    .filter(s -> !s.isBlank())
                    .distinct()
                    .toList();
            for (String singleArtist : artistTokens) {
                if (results.size() >= limit) break;
                int needed = limit - results.size();
                List<Song> artistMatches = excluded.isEmpty()
                        ? findActiveByArtistName(singleArtist, PageRequest.of(0, needed))
                        : findActiveByArtistNameExcluding(singleArtist, excluded, PageRequest.of(0, needed));
                for (Song s : artistMatches) {
                    results.add(s);
                    excluded.add(s.getId());
                    if (results.size() >= limit) break;
                }
            }
        }

        // 4. Same language
        if (language != null && !language.isBlank() && results.size() < limit) {
            int needed = limit - results.size();
            List<Song> langMatches = excluded.isEmpty()
                    ? findActiveByLanguage(language.trim(), PageRequest.of(0, needed))
                    : findActiveByLanguageExcluding(language.trim(), excluded, PageRequest.of(0, needed));
            for (Song s : langMatches) {
                results.add(s);
                excluded.add(s.getId());
                if (results.size() >= limit) break;
            }
        }

        // 5. Aakhir me koi bhi active songs
        if (results.size() < limit) {
            int needed = limit - results.size();
            List<Song> generalMatches = excluded.isEmpty()
                    ? findActiveSongs(PageRequest.of(0, needed))
                    : findActiveSongsExcluding(excluded, PageRequest.of(0, needed));
            results.addAll(generalMatches);
        }

        return results;
    }

    /** Chhota version: sirf artist aur language se. */
    default List<Song> findRadioFallback(String artistName, String language, List<String> excludeIds, int limit) {
        return findRadioFallback(null, null, artistName, language, excludeIds, limit);
    }

    /** Album ke saare songs, purane pehle (track order jaisa). */
    @EntityGraph(attributePaths = {"songMetadata"})
    @Query("SELECT s FROM Song s WHERE LOWER(TRIM(s.album)) = LOWER(TRIM(:album)) AND s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE ORDER BY s.createdAt ASC")
    List<Song> findByAlbum(@Param("album") String album);

    /** Ek country ke songs, page by page. */
    @EntityGraph(attributePaths = {"songMetadata"})
    @Query("SELECT s FROM Song s WHERE LOWER(TRIM(s.country)) = LOWER(TRIM(:country)) AND s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE ORDER BY s.createdAt DESC")
    List<Song> findByCountry(@Param("country") String country, Pageable pageable);

    /** Ek country ke saare songs. */
    @EntityGraph(attributePaths = {"songMetadata"})
    @Query("SELECT s FROM Song s WHERE LOWER(TRIM(s.country)) = LOWER(TRIM(:country)) AND s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE ORDER BY s.createdAt DESC")
    List<Song> findByCountry(@Param("country") String country);

    /** Albums ki list (album + artist se group): [album, artist, kitne songs, ek image, ek genre]. */
    @Query("SELECT s.album, s.artistName, COUNT(s), MIN(s.imageKey), MIN(s.genre) " +
           "FROM Song s " +
           "WHERE s.album IS NOT NULL AND TRIM(s.album) != '' AND s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE " +
           "GROUP BY s.album, s.artistName " +
           "ORDER BY s.album ASC")
    List<Object[]> findDistinctAlbums();

    /** Jin playlists me ye song hai, unka song count -1. */
    @Modifying
    @Transactional
    @Query(value = "UPDATE playlists SET total_songs = GREATEST(0, total_songs - 1) WHERE id IN (SELECT playlist_id FROM playlist_songs WHERE song_id = :id)", nativeQuery = true)
    void decrementPlaylistTotalSongs(@Param("id") String id);

    /** Jin user playlists me ye song hai, unka song count -1. */
    @Modifying
    @Transactional
    @Query(value = "UPDATE user_playlists SET total_songs = GREATEST(0, total_songs - 1) WHERE id IN (SELECT user_playlist_id FROM user_playlist_songs WHERE song_id = :id)", nativeQuery = true)
    void decrementUserPlaylistTotalSongs(@Param("id") String id);

    /** Saari playlists se ye song hatao. */
    @Modifying
    @Transactional
    @Query(value = "DELETE FROM playlist_songs WHERE song_id = :id", nativeQuery = true)
    void deletePlaylistSongsBySongId(@Param("id") String id);

    /** Saari user playlists se ye song hatao. */
    @Modifying
    @Transactional
    @Query(value = "DELETE FROM user_playlist_songs WHERE song_id = :id", nativeQuery = true)
    void deleteUserPlaylistSongsBySongId(@Param("id") String id);

    /** Sabke favourites se ye song hatao. */
    @Modifying
    @Transactional
    @Query(value = "DELETE FROM user_favourite_songs WHERE song_id = :id", nativeQuery = true)
    void deleteUserFavouriteSongsBySongId(@Param("id") String id);

    /** Sabki history se ye song hatao. */
    @Modifying
    @Transactional
    @Query(value = "DELETE FROM user_history WHERE song_id = :id", nativeQuery = true)
    void deleteUserHistoryBySongId(@Param("id") String id);

    /**
     * Song ko poori tarah delete: pehle counts ghatao, phir har jagah se links hatao,
     * aakhir me song. Sab ek transaction me - beech me fail ho to kuch bhi nahi badlega.
     */
    @Transactional
    default void deleteSongCascade(String id) {
        decrementPlaylistTotalSongs(id);
        decrementUserPlaylistTotalSongs(id);
        deletePlaylistSongsBySongId(id);
        deleteUserPlaylistSongsBySongId(id);
        deleteUserFavouriteSongsBySongId(id);
        deleteUserHistoryBySongId(id);
        deleteById(id);
    }
}
