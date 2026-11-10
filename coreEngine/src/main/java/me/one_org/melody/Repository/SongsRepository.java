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

public interface SongsRepository extends JpaRepository<Song, String> {

    @Override
    @EntityGraph(attributePaths = {"songMetadata"})
    Optional<Song> findById(String id);

    @EntityGraph(attributePaths = {"songMetadata"})
    List<Song> findByStatus(StatusEnum status);

    @EntityGraph(attributePaths = {"songMetadata"})
    @Query("SELECT s FROM Song s ORDER BY s.createdAt DESC")
    List<Song> findAllPaginatedQuery(Pageable pageable);

    default List<Song> findAllPaginated(int page, int size) {
        return findAllPaginatedQuery(PageRequest.of(page, size));
    }

    @EntityGraph(attributePaths = {"songMetadata"})
    @Query("SELECT s FROM Song s WHERE LOWER(s.title) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "OR LOWER(s.artistName) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "OR LOWER(s.album) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "OR LOWER(s.country) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "ORDER BY s.createdAt DESC")
    List<Song> findAllPaginatedWithSearch(@Param("search") String search, Pageable pageable);

    default List<Song> findAllPaginated(int page, int size, String search) {
        if (search == null || search.trim().isEmpty()) {
            return findAllPaginated(page, size);
        }
        return findAllPaginatedWithSearch(search.trim(), PageRequest.of(page, size));
    }

    @Query("SELECT COUNT(s) FROM Song s WHERE LOWER(s.title) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "OR LOWER(s.artistName) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "OR LOWER(s.album) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "OR LOWER(s.country) LIKE LOWER(CONCAT('%', :search, '%'))")
    long countSongsWithSearch(@Param("search") String search);

    default long countSongs(String search) {
        if (search == null || search.trim().isEmpty()) {
            return count();
        }
        return countSongsWithSearch(search.trim());
    }

    @Query("SELECT h.song.id FROM UserHistory h " +
           "WHERE h.song.status = me.one_org.melody.Enums.StatusEnum.ACTIVE " +
           "AND h.listenedAt >= :since " +
           "GROUP BY h.song.id " +
           "ORDER BY (SUM(h.part + 50) + COUNT(DISTINCT h.user.id) * 200) DESC")
    List<String> findTrendingSongIdsSince(
            @Param("since") LocalDateTime since,
            Pageable pageable);

    @Query("SELECT h.song.id FROM UserHistory h " +
           "WHERE h.song.status = me.one_org.melody.Enums.StatusEnum.ACTIVE " +
           "GROUP BY h.song.id " +
           "ORDER BY (SUM(h.part + 50) + COUNT(DISTINCT h.user.id) * 200) DESC")
    List<String> findTrendingSongIdsAllTime(Pageable pageable);

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

    @Query("SELECT h.song.id FROM UserHistory h " +
           "WHERE h.song.status = me.one_org.melody.Enums.StatusEnum.ACTIVE " +
           "AND LOWER(h.song.genre) = LOWER(:genre) " +
           "GROUP BY h.song.id " +
           "ORDER BY (SUM(h.part + 50) + COUNT(DISTINCT h.user.id) * 200) DESC")
    List<String> findTrendingSongIdsAllTimeAndGenre(
            @Param("genre") String genre,
            Pageable pageable);

    default List<String> findTrendingSongIds(Pageable pageable) {
        return findTrendingSongIdsAllTime(pageable);
    }

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

    @EntityGraph(attributePaths = {"songMetadata"})
    @Query("SELECT s FROM Song s " +
           "LEFT JOIN s.songMetadata sm " +
           "WHERE s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE " +
           "ORDER BY COALESCE(sm.totalStreams, 0) DESC, s.createdAt DESC")
    List<Song> findPopularActiveSongs(Pageable pageable);

    @EntityGraph(attributePaths = {"songMetadata"})
    @Query("SELECT s FROM Song s " +
           "LEFT JOIN s.songMetadata sm " +
           "WHERE s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE " +
           "AND s.id NOT IN :existingIds " +
           "ORDER BY COALESCE(sm.totalStreams, 0) DESC, s.createdAt DESC")
    List<Song> findPopularActiveSongsExcluding(
            @Param("existingIds") List<String> existingIds,
            Pageable pageable);

    @EntityGraph(attributePaths = {"songMetadata"})
    @Query("SELECT s FROM Song s " +
           "LEFT JOIN s.songMetadata sm " +
           "WHERE s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE " +
           "AND LOWER(s.genre) = LOWER(:genre) " +
           "ORDER BY COALESCE(sm.totalStreams, 0) DESC, s.createdAt DESC")
    List<Song> findPopularActiveSongsByGenre(
            @Param("genre") String genre,
            Pageable pageable);

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

    @EntityGraph(attributePaths = {"songMetadata"})
    @Query("SELECT s FROM Song s WHERE s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE ORDER BY s.createdAt DESC")
    List<Song> findActiveSongs(Pageable pageable);

    @EntityGraph(attributePaths = {"songMetadata"})
    @Query("SELECT s FROM Song s WHERE s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE AND s.id NOT IN :existingIds ORDER BY s.createdAt DESC")
    List<Song> findActiveSongsExcluding(@Param("existingIds") List<String> existingIds, Pageable pageable);

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

        // If a narrow window (e.g. 24h or 7d) has 0 listens, fallback to all-time trending before falling back to catalog
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

            // If still not enough (e.g. niche genre with few tracks), fill with general active songs
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

    default List<Song> findTrending(int limit) {
        return findTrending(limit, "7d", null, null);
    }

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

    @EntityGraph(attributePaths = {"songMetadata"})
    @Query("SELECT s FROM Song s WHERE s.isFeatured = true AND s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE ORDER BY s.createdAt DESC")
    List<Song> findFeatured();

    @EntityGraph(attributePaths = {"songMetadata"})
    @Query("SELECT s FROM Song s WHERE ((s.fullVideoKey IS NOT NULL AND TRIM(s.fullVideoKey) <> '') OR (s.videoKey IS NOT NULL AND TRIM(s.videoKey) <> '')) AND s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE ORDER BY s.createdAt DESC")
    List<Song> findSongsWithVideo(Pageable pageable);

    default List<Song> findSongsWithVideo(int limit) {
        return findSongsWithVideo(PageRequest.of(0, limit));
    }

    @EntityGraph(attributePaths = {"songMetadata"})
    @Query("SELECT s FROM Song s WHERE ((s.fullVideoKey IS NOT NULL AND TRIM(s.fullVideoKey) <> '') OR (s.videoKey IS NOT NULL AND TRIM(s.videoKey) <> '')) " +
           "AND s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE " +
           "AND (:genre IS NULL OR LOWER(s.genre) = LOWER(:genre) OR LOWER(s.genre) LIKE LOWER(CONCAT('%', :genre, '%'))) " +
           "AND (:language IS NULL OR LOWER(s.language) = LOWER(:language)) " +
           "ORDER BY s.createdAt DESC")
    List<Song> findVideosLatest(@Param("genre") String genre, @Param("language") String language, Pageable pageable);

    @Query("SELECT COUNT(s) FROM Song s WHERE ((s.fullVideoKey IS NOT NULL AND TRIM(s.fullVideoKey) <> '') OR (s.videoKey IS NOT NULL AND TRIM(s.videoKey) <> '')) " +
           "AND s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE " +
           "AND (:genre IS NULL OR LOWER(s.genre) = LOWER(:genre) OR LOWER(s.genre) LIKE LOWER(CONCAT('%', :genre, '%'))) " +
           "AND (:language IS NULL OR LOWER(s.language) = LOWER(:language))")
    long countVideos(@Param("genre") String genre, @Param("language") String language);

    @EntityGraph(attributePaths = {"songMetadata"})
    @Query("SELECT s FROM Song s WHERE ((s.videoKey IS NOT NULL AND TRIM(s.videoKey) <> '') OR (s.fullVideoKey IS NOT NULL AND TRIM(s.fullVideoKey) <> '')) " +
           "AND s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE " +
           "AND (:genre IS NULL OR LOWER(s.genre) = LOWER(:genre) OR LOWER(s.genre) LIKE LOWER(CONCAT('%', :genre, '%'))) " +
           "ORDER BY s.createdAt DESC")
    List<Song> findCanvasSongsLatest(@Param("genre") String genre, Pageable pageable);

    @EntityGraph(attributePaths = {"songMetadata"})
    @Query("SELECT s FROM Song s LEFT JOIN s.songMetadata sm " +
           "WHERE ((s.videoKey IS NOT NULL AND TRIM(s.videoKey) <> '') OR (s.fullVideoKey IS NOT NULL AND TRIM(s.fullVideoKey) <> '')) " +
           "AND s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE " +
           "AND (:genre IS NULL OR LOWER(s.genre) = LOWER(:genre) OR LOWER(s.genre) LIKE LOWER(CONCAT('%', :genre, '%'))) " +
           "ORDER BY COALESCE(sm.totalStreams, 0) DESC, s.createdAt DESC")
    List<Song> findCanvasSongsPopular(@Param("genre") String genre, Pageable pageable);

    @EntityGraph(attributePaths = {"songMetadata"})
    @Query("SELECT s FROM Song s WHERE ((s.videoKey IS NOT NULL AND TRIM(s.videoKey) <> '') OR (s.fullVideoKey IS NOT NULL AND TRIM(s.fullVideoKey) <> '')) " +
           "AND s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE " +
           "AND (:genre IS NULL OR LOWER(s.genre) = LOWER(:genre) OR LOWER(s.genre) LIKE LOWER(CONCAT('%', :genre, '%'))) " +
           "ORDER BY function('random')")
    List<Song> findCanvasSongsRandom(@Param("genre") String genre, Pageable pageable);

    @Query("SELECT COUNT(s) FROM Song s WHERE ((s.videoKey IS NOT NULL AND TRIM(s.videoKey) <> '') OR (s.fullVideoKey IS NOT NULL AND TRIM(s.fullVideoKey) <> '')) " +
           "AND s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE " +
           "AND (:genre IS NULL OR LOWER(s.genre) = LOWER(:genre) OR LOWER(s.genre) LIKE LOWER(CONCAT('%', :genre, '%')))")
    long countCanvasSongs(@Param("genre") String genre);

    @EntityGraph(attributePaths = {"songMetadata"})
    @Query("SELECT s FROM Song s LEFT JOIN s.songMetadata sm " +
           "WHERE ((s.fullVideoKey IS NOT NULL AND TRIM(s.fullVideoKey) <> '') OR (s.videoKey IS NOT NULL AND TRIM(s.videoKey) <> '')) " +
           "AND s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE " +
           "AND (:genre IS NULL OR LOWER(s.genre) = LOWER(:genre) OR LOWER(s.genre) LIKE LOWER(CONCAT('%', :genre, '%'))) " +
           "AND (:language IS NULL OR LOWER(s.language) = LOWER(:language)) " +
           "ORDER BY COALESCE(sm.totalStreams, 0) DESC, s.createdAt DESC")
    List<Song> findVideosPopular(@Param("genre") String genre, @Param("language") String language, Pageable pageable);

    @EntityGraph(attributePaths = {"songMetadata"})
    @Query("SELECT s FROM Song s WHERE ((s.fullVideoKey IS NOT NULL AND TRIM(s.fullVideoKey) <> '') OR (s.videoKey IS NOT NULL AND TRIM(s.videoKey) <> '')) " +
           "AND s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE " +
           "AND (LOWER(s.artistName) = LOWER(:artistName) OR LOWER(s.artistName) LIKE LOWER(CONCAT('%', :artistName, '%'))) " +
           "ORDER BY s.createdAt DESC")
    List<Song> findVideosByArtist(@Param("artistName") String artistName, Pageable pageable);

    @Query("SELECT COUNT(s) FROM Song s WHERE ((s.fullVideoKey IS NOT NULL AND TRIM(s.fullVideoKey) <> '') OR (s.videoKey IS NOT NULL AND TRIM(s.videoKey) <> '')) " +
           "AND s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE " +
           "AND (LOWER(s.artistName) = LOWER(:artistName) OR LOWER(s.artistName) LIKE LOWER(CONCAT('%', :artistName, '%')))")
    long countVideosByArtist(@Param("artistName") String artistName);

    @Query("SELECT h.song.id FROM UserHistory h " +
           "WHERE h.song.status = me.one_org.melody.Enums.StatusEnum.ACTIVE " +
           "AND ((h.song.fullVideoKey IS NOT NULL AND TRIM(h.song.fullVideoKey) <> '') OR (h.song.videoKey IS NOT NULL AND TRIM(h.song.videoKey) <> '')) " +
           "AND h.listenedAt >= :since " +
           "GROUP BY h.song.id " +
           "ORDER BY (SUM(h.part + 50) + COUNT(DISTINCT h.user.id) * 200) DESC")
    List<String> findTrendingVideoIdsSince(@Param("since") LocalDateTime since, Pageable pageable);

    @Query("SELECT h.song.id FROM UserHistory h " +
           "WHERE h.song.status = me.one_org.melody.Enums.StatusEnum.ACTIVE " +
           "AND ((h.song.fullVideoKey IS NOT NULL AND TRIM(h.song.fullVideoKey) <> '') OR (h.song.videoKey IS NOT NULL AND TRIM(h.song.videoKey) <> '')) " +
           "GROUP BY h.song.id " +
           "ORDER BY (SUM(h.part + 50) + COUNT(DISTINCT h.user.id) * 200) DESC")
    List<String> findTrendingVideoIdsAllTime(Pageable pageable);

    @Query("SELECT h.song.id FROM UserHistory h " +
           "WHERE h.song.status = me.one_org.melody.Enums.StatusEnum.ACTIVE " +
           "AND ((h.song.fullVideoKey IS NOT NULL AND TRIM(h.song.fullVideoKey) <> '') OR (h.song.videoKey IS NOT NULL AND TRIM(h.song.videoKey) <> '')) " +
           "AND h.listenedAt >= :since " +
           "AND (LOWER(h.song.genre) = LOWER(:genre) OR LOWER(h.song.genre) LIKE LOWER(CONCAT('%', :genre, '%'))) " +
           "GROUP BY h.song.id " +
           "ORDER BY (SUM(h.part + 50) + COUNT(DISTINCT h.user.id) * 200) DESC")
    List<String> findTrendingVideoIdsSinceAndGenre(@Param("since") LocalDateTime since, @Param("genre") String genre, Pageable pageable);

    @Query("SELECT h.song.id FROM UserHistory h " +
           "WHERE h.song.status = me.one_org.melody.Enums.StatusEnum.ACTIVE " +
           "AND ((h.song.fullVideoKey IS NOT NULL AND TRIM(h.song.fullVideoKey) <> '') OR (h.song.videoKey IS NOT NULL AND TRIM(h.song.videoKey) <> '')) " +
           "AND (LOWER(h.song.genre) = LOWER(:genre) OR LOWER(h.song.genre) LIKE LOWER(CONCAT('%', :genre, '%'))) " +
           "GROUP BY h.song.id " +
           "ORDER BY (SUM(h.part + 50) + COUNT(DISTINCT h.user.id) * 200) DESC")
    List<String> findTrendingVideoIdsAllTimeAndGenre(@Param("genre") String genre, Pageable pageable);

    @EntityGraph(attributePaths = {"songMetadata"})
    @Query("SELECT s FROM Song s WHERE ((s.fullVideoKey IS NOT NULL AND TRIM(s.fullVideoKey) <> '') OR (s.videoKey IS NOT NULL AND TRIM(s.videoKey) <> '')) " +
           "AND s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE " +
           "AND s.id NOT IN :excluded " +
           "AND (LOWER(s.artistName) = LOWER(:artistName) OR LOWER(s.artistName) LIKE LOWER(CONCAT('%', :artistName, '%'))) " +
           "ORDER BY s.createdAt DESC")
    List<Song> findActiveVideosByArtistExcluding(@Param("artistName") String artistName, @Param("excluded") List<String> excluded, Pageable pageable);

    @EntityGraph(attributePaths = {"songMetadata"})
    @Query("SELECT s FROM Song s WHERE ((s.fullVideoKey IS NOT NULL AND TRIM(s.fullVideoKey) <> '') OR (s.videoKey IS NOT NULL AND TRIM(s.videoKey) <> '')) " +
           "AND s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE " +
           "AND s.id NOT IN :excluded " +
           "AND (LOWER(s.genre) = LOWER(:genre) OR LOWER(s.genre) LIKE LOWER(CONCAT('%', :genre, '%'))) " +
           "ORDER BY s.createdAt DESC")
    List<Song> findActiveVideosByGenreExcluding(@Param("genre") String genre, @Param("excluded") List<String> excluded, Pageable pageable);

    @EntityGraph(attributePaths = {"songMetadata"})
    @Query("SELECT s FROM Song s LEFT JOIN s.songMetadata sm " +
           "WHERE ((s.fullVideoKey IS NOT NULL AND TRIM(s.fullVideoKey) <> '') OR (s.videoKey IS NOT NULL AND TRIM(s.videoKey) <> '')) " +
           "AND s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE " +
           "AND s.id NOT IN :excluded " +
           "ORDER BY COALESCE(sm.totalStreams, 0) DESC, s.createdAt DESC")
    List<Song> findActiveVideosExcluding(@Param("excluded") List<String> excluded, Pageable pageable);

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

    default List<Song> findRelatedVideos(String songId, String artistName, String genre, int limit) {
        int safeLimit = Math.max(1, Math.min(30, limit));
        List<Song> results = new ArrayList<>();
        List<String> excluded = new ArrayList<>();
        if (songId != null && !songId.isBlank()) {
            excluded.add(songId);
        }

        // 1. Same Artist
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

        // 2. Same Genre
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

        // 3. Fallback to popular active videos
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

    @Query("SELECT COUNT(s) FROM Song s WHERE s.isFeatured = true AND s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE")
    long countFeatured();

    @EntityGraph(attributePaths = {"songMetadata"})
    List<Song> findByIdIn(List<String> ids);

    default List<Song> findAllByIds(List<String> ids) {
        if (ids == null || ids.isEmpty()) return List.of();
        return findByIdIn(ids);
    }

    @EntityGraph(attributePaths = {"songMetadata"})
    @Query("SELECT s FROM Song s WHERE s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE AND (LOWER(s.artistName) = LOWER(:artistName) OR LOWER(s.artistName) LIKE LOWER(CONCAT('%', :artistName, '%'))) ORDER BY s.createdAt DESC")
    List<Song> findActiveByArtistName(@Param("artistName") String artistName, Pageable pageable);

    @Query("SELECT COUNT(s) FROM Song s WHERE s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE AND (LOWER(s.artistName) = LOWER(:artistName) OR LOWER(s.artistName) LIKE LOWER(CONCAT('%', :artistName, '%')))")
    long countActiveByArtistName(@Param("artistName") String artistName);

    @EntityGraph(attributePaths = {"songMetadata"})
    @Query("SELECT s FROM Song s WHERE s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE AND LOWER(s.artistName) = LOWER(:artistName) AND s.id NOT IN :excluded ORDER BY s.createdAt DESC")
    List<Song> findActiveByArtistNameExcluding(@Param("artistName") String artistName, @Param("excluded") List<String> excluded, Pageable pageable);

    @EntityGraph(attributePaths = {"songMetadata"})
    @Query("SELECT s FROM Song s WHERE s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE AND LOWER(s.language) = LOWER(:language) ORDER BY s.createdAt DESC")
    List<Song> findActiveByLanguage(@Param("language") String language, Pageable pageable);

    @EntityGraph(attributePaths = {"songMetadata"})
    @Query("SELECT s FROM Song s WHERE s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE AND LOWER(s.language) = LOWER(:language) AND s.id NOT IN :excluded ORDER BY s.createdAt DESC")
    List<Song> findActiveByLanguageExcluding(@Param("language") String language, @Param("excluded") List<String> excluded, Pageable pageable);

    @EntityGraph(attributePaths = {"songMetadata"})
    @Query("SELECT s FROM Song s WHERE s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE AND (LOWER(s.genre) = LOWER(:genre) OR LOWER(s.genre) LIKE LOWER(CONCAT('%', :genre, '%'))) ORDER BY s.createdAt DESC")
    List<Song> findActiveByGenre(@Param("genre") String genre, Pageable pageable);

    @EntityGraph(attributePaths = {"songMetadata"})
    @Query("SELECT s FROM Song s WHERE s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE AND (LOWER(s.genre) = LOWER(:genre) OR LOWER(s.genre) LIKE LOWER(CONCAT('%', :genre, '%'))) AND s.id NOT IN :excluded ORDER BY s.createdAt DESC")
    List<Song> findActiveByGenreExcluding(@Param("genre") String genre, @Param("excluded") List<String> excluded, Pageable pageable);

    default List<Song> findRadioFallback(String album, String genre, String artistName, String language, List<String> excludeIds, int limit) {
        List<Song> results = new ArrayList<>();
        List<String> excluded = excludeIds != null ? new ArrayList<>(excludeIds) : new ArrayList<>();

        // 1. Same Album / Movie (capped at 3 to preserve radio diversity across artists/genres)
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

        // 2. Same Genre (handles comma-separated multi-genre strings)
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

        // 3. Same Artist (handles comma-separated multi-artist strings)
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

        // 4. Same Language
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

        // 5. Active general catalog tracks
        if (results.size() < limit) {
            int needed = limit - results.size();
            List<Song> generalMatches = excluded.isEmpty()
                    ? findActiveSongs(PageRequest.of(0, needed))
                    : findActiveSongsExcluding(excluded, PageRequest.of(0, needed));
            results.addAll(generalMatches);
        }

        return results;
    }

    default List<Song> findRadioFallback(String artistName, String language, List<String> excludeIds, int limit) {
        return findRadioFallback(null, null, artistName, language, excludeIds, limit);
    }

    @EntityGraph(attributePaths = {"songMetadata"})
    @Query("SELECT s FROM Song s WHERE LOWER(TRIM(s.album)) = LOWER(TRIM(:album)) AND s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE ORDER BY s.createdAt ASC")
    List<Song> findByAlbum(@Param("album") String album);

    @EntityGraph(attributePaths = {"songMetadata"})
    @Query("SELECT s FROM Song s WHERE LOWER(TRIM(s.country)) = LOWER(TRIM(:country)) AND s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE ORDER BY s.createdAt DESC")
    List<Song> findByCountry(@Param("country") String country, Pageable pageable);

    @EntityGraph(attributePaths = {"songMetadata"})
    @Query("SELECT s FROM Song s WHERE LOWER(TRIM(s.country)) = LOWER(TRIM(:country)) AND s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE ORDER BY s.createdAt DESC")
    List<Song> findByCountry(@Param("country") String country);

    @Query("SELECT s.album, s.artistName, COUNT(s), MIN(s.imageKey), MIN(s.genre) " +
           "FROM Song s " +
           "WHERE s.album IS NOT NULL AND TRIM(s.album) != '' AND s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE " +
           "GROUP BY s.album, s.artistName " +
           "ORDER BY s.album ASC")
    List<Object[]> findDistinctAlbums();

    @Modifying
    @Transactional
    @Query(value = "UPDATE playlists SET total_songs = GREATEST(0, total_songs - 1) WHERE id IN (SELECT playlist_id FROM playlist_songs WHERE song_id = :id)", nativeQuery = true)
    void decrementPlaylistTotalSongs(@Param("id") String id);

    @Modifying
    @Transactional
    @Query(value = "UPDATE user_playlists SET total_songs = GREATEST(0, total_songs - 1) WHERE id IN (SELECT user_playlist_id FROM user_playlist_songs WHERE song_id = :id)", nativeQuery = true)
    void decrementUserPlaylistTotalSongs(@Param("id") String id);

    @Modifying
    @Transactional
    @Query(value = "DELETE FROM playlist_songs WHERE song_id = :id", nativeQuery = true)
    void deletePlaylistSongsBySongId(@Param("id") String id);

    @Modifying
    @Transactional
    @Query(value = "DELETE FROM user_playlist_songs WHERE song_id = :id", nativeQuery = true)
    void deleteUserPlaylistSongsBySongId(@Param("id") String id);

    @Modifying
    @Transactional
    @Query(value = "DELETE FROM user_favourite_songs WHERE song_id = :id", nativeQuery = true)
    void deleteUserFavouriteSongsBySongId(@Param("id") String id);

    @Modifying
    @Transactional
    @Query(value = "DELETE FROM user_history WHERE song_id = :id", nativeQuery = true)
    void deleteUserHistoryBySongId(@Param("id") String id);

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
