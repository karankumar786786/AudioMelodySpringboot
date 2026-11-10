package me.one_org.melody.Services.Api;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import me.one_org.melody.Dto.Controllers.Api.PaginationMetaDataDto;
import me.one_org.melody.Dto.Controllers.Api.SongDto;
import me.one_org.melody.Dto.Controllers.PaginatedResponseDto;
import me.one_org.melody.Entity.Song;
import me.one_org.melody.Repository.SongsRepository;
import me.one_org.melody.Repository.UserShortsLikeRepository;

@Service
@Transactional(readOnly = true)
public class CanvasApiService {

    private final SongsRepository songsRepository;
    private final UserShortsLikeRepository shortsLikeRepository;

    public CanvasApiService(SongsRepository songsRepository, UserShortsLikeRepository shortsLikeRepository) {
        this.songsRepository = songsRepository;
        this.shortsLikeRepository = shortsLikeRepository;
    }

    public PaginatedResponseDto<SongDto> getCanvasFeed(int page, int size, String genre, String sort) {
        return getCanvasFeed(null, page, size, genre, sort);
    }

    public PaginatedResponseDto<SongDto> getCanvasFeed(String userId, int page, int size, String genre, String sort) {
        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(50, size));
        String cleanGenre = (genre != null && !genre.trim().isBlank() && !genre.trim().equalsIgnoreCase("all"))
                ? genre.trim() : null;
        String effectiveSort = (sort != null && !sort.trim().isBlank()) ? sort.trim().toLowerCase() : "latest";

        List<Song> songs;
        if ("random".equals(effectiveSort) || "discover".equals(effectiveSort) || "shuffle".equals(effectiveSort)) {
            songs = songsRepository.findCanvasSongsRandom(cleanGenre, PageRequest.of(safePage, safeSize));
        } else if ("popular".equals(effectiveSort)) {
            songs = songsRepository.findCanvasSongsPopular(cleanGenre, PageRequest.of(safePage, safeSize));
        } else {
            songs = songsRepository.findCanvasSongsLatest(cleanGenre, PageRequest.of(safePage, safeSize));
        }

        long totalCount = songsRepository.countCanvasSongs(cleanGenre);
        PaginationMetaDataDto meta = new PaginationMetaDataDto(
                "canvas_feed",
                "songs",
                totalCount,
                totalCount,
                0L,
                0L,
                LocalDateTime.now()
        );

        List<String> songIds = songs.stream().map(Song::getId).toList();
        Set<String> likedIdsSet = (userId != null && !userId.isBlank() && !songIds.isEmpty())
                ? new HashSet<>(shortsLikeRepository.findLikedSongIdsByUserIdAndSongIds(userId, songIds))
                : Collections.emptySet();

        Map<String, Long> likesCountMap = !songIds.isEmpty()
                ? shortsLikeRepository.countLikesBySongIds(songIds).stream()
                        .collect(Collectors.toMap(
                                arr -> (String) arr[0],
                                arr -> (Long) arr[1],
                                (a, b) -> a
                        ))
                : Collections.emptyMap();

        List<SongDto> dtos = songs.stream()
                .map(s -> SongDto.fromEntity(
                        s,
                        likedIdsSet.contains(s.getId()),
                        likesCountMap.getOrDefault(s.getId(), 0L)
                ))
                .toList();

        return new PaginatedResponseDto<>(dtos, safePage, safeSize, meta);
    }

    @Cacheable(value = "canvas_featured", key = "#limit")
    public List<SongDto> getFeaturedCanvas(int limit) {
        int safeLimit = Math.max(1, Math.min(30, limit));
        return songsRepository.findCanvasSongsPopular(null, PageRequest.of(0, safeLimit)).stream()
                .map(SongDto::fromEntity)
                .toList();
    }
}

