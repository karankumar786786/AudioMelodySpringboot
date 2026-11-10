package me.one_org.melody.Services.Api;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import me.one_org.melody.Dto.Controllers.Api.PaginationMetaDataDto;
import me.one_org.melody.Dto.Controllers.Api.SongDto;
import me.one_org.melody.Dto.Controllers.PaginatedResponseDto;
import me.one_org.melody.Entity.Song;
import me.one_org.melody.Repository.SongsRepository;

@Service
@Transactional(readOnly = true)
public class CanvasApiService {

    private final SongsRepository songsRepository;

    public CanvasApiService(SongsRepository songsRepository) {
        this.songsRepository = songsRepository;
    }

    public PaginatedResponseDto<SongDto> getCanvasFeed(int page, int size, String genre, String sort) {
        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(50, size));
        String cleanGenre = (genre != null && !genre.trim().isBlank() && !genre.trim().equalsIgnoreCase("all"))
                ? genre.trim() : null;
        String effectiveSort = (sort != null && !sort.trim().isBlank()) ? sort.trim().toLowerCase() : "latest";

        List<Song> songs;
        if ("popular".equals(effectiveSort)) {
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

        List<SongDto> dtos = songs.stream()
                .map(SongDto::fromEntity)
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

