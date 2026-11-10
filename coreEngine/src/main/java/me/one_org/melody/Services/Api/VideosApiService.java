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
public class VideosApiService {

    private final SongsRepository songsRepository;

    public VideosApiService(SongsRepository songsRepository) {
        this.songsRepository = songsRepository;
    }

    public PaginatedResponseDto<SongDto> getVideos(int page, int size, String genre, String language, String sort) {
        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(50, size));
        String cleanGenre = (genre != null && !genre.trim().isBlank() && !genre.trim().equalsIgnoreCase("all"))
                ? genre.trim() : null;
        String cleanLanguage = (language != null && !language.trim().isBlank() && !language.trim().equalsIgnoreCase("all"))
                ? language.trim() : null;
        String effectiveSort = (sort != null && !sort.trim().isBlank()) ? sort.trim().toLowerCase() : "latest";

        List<Song> songs;
        if ("popular".equals(effectiveSort)) {
            songs = songsRepository.findVideosPopular(cleanGenre, cleanLanguage, PageRequest.of(safePage, safeSize));
        } else if ("trending".equals(effectiveSort)) {
            // Trending returns top ranked; for page 0 return trending, subsequent pages fallback to popular
            if (safePage == 0) {
                songs = songsRepository.findTrendingVideos(safeSize, "7d", cleanGenre, cleanLanguage);
            } else {
                songs = songsRepository.findVideosPopular(cleanGenre, cleanLanguage, PageRequest.of(safePage, safeSize));
            }
        } else {
            songs = songsRepository.findVideosLatest(cleanGenre, cleanLanguage, PageRequest.of(safePage, safeSize));
        }

        long totalCount = songsRepository.countVideos(cleanGenre, cleanLanguage);
        PaginationMetaDataDto meta = new PaginationMetaDataDto(
                "videos",
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

    @Cacheable(
        value = "trending_videos",
        key = "#limit + '_' + (#window != null ? #window : '7d') + '_' + (#genre != null ? #genre : 'all') + '_' + (#language != null ? #language : 'all')"
    )
    public List<SongDto> getTrendingVideos(int limit, String window, String genre, String language) {
        int safeLimit = Math.max(1, Math.min(50, limit));
        String cleanGenre = (genre != null && !genre.trim().isBlank() && !genre.trim().equalsIgnoreCase("all"))
                ? genre.trim() : null;
        String cleanLanguage = (language != null && !language.trim().isBlank() && !language.trim().equalsIgnoreCase("all"))
                ? language.trim() : null;

        return songsRepository.findTrendingVideos(safeLimit, window, cleanGenre, cleanLanguage).stream()
                .map(SongDto::fromEntity)
                .toList();
    }

    @Cacheable(
        value = "popular_videos",
        key = "#limit + '_' + (#genre != null ? #genre : 'all') + '_' + (#language != null ? #language : 'all')"
    )
    public List<SongDto> getPopularVideos(int limit, String genre, String language) {
        int safeLimit = Math.max(1, Math.min(50, limit));
        String cleanGenre = (genre != null && !genre.trim().isBlank() && !genre.trim().equalsIgnoreCase("all"))
                ? genre.trim() : null;
        String cleanLanguage = (language != null && !language.trim().isBlank() && !language.trim().equalsIgnoreCase("all"))
                ? language.trim() : null;

        return songsRepository.findVideosPopular(cleanGenre, cleanLanguage, PageRequest.of(0, safeLimit)).stream()
                .map(SongDto::fromEntity)
                .toList();
    }

    @Cacheable(value = "related_videos", key = "#songId + '_' + #limit")
    public List<SongDto> getRelatedVideos(String songId, int limit) {
        int safeLimit = Math.max(1, Math.min(30, limit));
        Song currentSong = songsRepository.findById(songId)
                .orElse(null);

        String artistName = currentSong != null ? currentSong.getArtistName() : null;
        String genre = currentSong != null ? currentSong.getGenre() : null;

        return songsRepository.findRelatedVideos(songId, artistName, genre, safeLimit).stream()
                .map(SongDto::fromEntity)
                .toList();
    }

    public PaginatedResponseDto<SongDto> getVideosByArtist(String artistName, int page, int size) {
        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(50, size));
        String cleanArtist = (artistName != null) ? artistName.trim() : "";

        List<Song> songs = songsRepository.findVideosByArtist(cleanArtist, PageRequest.of(safePage, safeSize));
        long totalCount = songsRepository.countVideosByArtist(cleanArtist);

        PaginationMetaDataDto meta = new PaginationMetaDataDto(
                "artist_videos",
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
}
