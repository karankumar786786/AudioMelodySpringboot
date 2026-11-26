package me.one_org.melody.Services.Api;

import java.util.List;

import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import me.one_org.melody.Dto.Controllers.Api.PaginationMetaDataDto;
import me.one_org.melody.Dto.Controllers.Api.SongDto;
import me.one_org.melody.Entity.PaginationMetaData;
import me.one_org.melody.Entity.Song;
import me.one_org.melody.Exceptions.ResourceNotFoundException;
import me.one_org.melody.Repository.SongsRepository;
import me.one_org.melody.Services.General.PaginationMetaDataService;

import org.springframework.transaction.annotation.Transactional;

/**
 * Songs padhne ka logic: browse, trending, featured, videos, album, country (zyadatar cache ke saath).
 *
 * Service = asli business logic. Controller isko call karta hai, ye repositories (DB), cache aur
 * bahar ki services (Recombee, Algolia) ko use karta hai.
 * @Transactional(readOnly = true) = by default sirf padhne wale DB transactions (thode fast);
 * jo methods data badalte hain un pe alag se @Transactional laga hai.
 * @Cacheable = result Redis me cache hota hai (RedisConfig dekho).
 */
@Service
@Transactional(readOnly = true)
public class SongsApiService {

    private final SongsRepository songsRepository;
    private final PaginationMetaDataService paginationMetaDataService;

    public SongsApiService(SongsRepository songsRepository, PaginationMetaDataService paginationMetaDataService) {
        this.songsRepository = songsRepository;
        this.paginationMetaDataService = paginationMetaDataService;
    }

    /** Songs page by page. */
    public List<SongDto> browseSongs(int page, int size) {
        if (size <= 0 || page < 0) return List.of();

        // Page number total se bahar hai to DB query chalaye bina hi khaali list (count Redis cache se)
        PaginationMetaData meta = paginationMetaDataService.getMetaData("SongsEntity");
        if (meta != null && meta.getTotalCount() > 0 && (long) page * size >= meta.getTotalCount()) {
            return List.of();
        }

        return songsRepository.findAllPaginated(page, size).stream()
                .map(SongDto::fromEntity)
                .toList();
    }

    /** Trending songs (cache me, window + genre ke hisaab se). */
    @Cacheable(
        value = "trending_songs",
        key = "#limit + '_' + (#window != null ? #window : '7d') + '_' + (#genre != null ? #genre : 'all') + '_' + (#language != null ? #language : 'all')"
    )
    public List<SongDto> getTrendingSongs(int limit, String window, String genre, String language) {
        return songsRepository.findTrending(limit, window, genre, language).stream()
                .map(SongDto::fromEntity)
                .toList();
    }

    /** 7 din ka trending. */
    public List<SongDto> getTrendingSongs(int limit) {
        return getTrendingSongs(limit, "7d", null, null);
    }

    /** Id se song (cache me). Na mile to 404. */
    @Cacheable(value = "songs", key = "#id")
    public SongDto getSongById(String id) {
        Song song = songsRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Song not found with id: " + id));
        return SongDto.fromEntity(song);
    }

    /** Songs ke counts. */
    public PaginationMetaDataDto getPaginationMetaData() {
        PaginationMetaData meta = paginationMetaDataService.getMetaData("SongsEntity");
        return PaginationMetaDataDto.fromEntity(meta);
    }

    /** Featured songs (cache me). */
    @Cacheable(value = "featured_songs", key = "'all'")
    public List<SongDto> getFeaturedSongs() {
        return songsRepository.findFeatured().stream()
                .map(SongDto::fromEntity)
                .toList();
    }

    /** Video wale songs (cache me). */
    @Cacheable(value = "video_songs", key = "#limit")
    public List<SongDto> getSongsWithVideo(int limit) {
        int safeLimit = Math.max(1, Math.min(limit, 50));
        return songsRepository.findSongsWithVideo(safeLimit).stream()
                .map(SongDto::fromEntity)
                .toList();
    }

    /** Album ke songs. */
    public List<SongDto> getSongsByAlbum(String albumName) {
        return songsRepository.findByAlbum(albumName).stream()
                .map(SongDto::fromEntity)
                .toList();
    }

    /** Country ke songs. */
    public List<SongDto> getSongsByCountry(String countryName) {
        if (countryName == null || countryName.isBlank()) return List.of();
        return songsRepository.findByCountry(countryName.trim()).stream()
                .map(SongDto::fromEntity)
                .toList();
    }

    /** Saare albums (DB ki group-by rows ko AlbumDto me badal ke). */
    public List<me.one_org.melody.Dto.Controllers.AlbumDto> getAllAlbums() {
        return songsRepository.findDistinctAlbums().stream()
                .map(row -> new me.one_org.melody.Dto.Controllers.AlbumDto(
                        (String) row[0],
                        (String) row[1],
                        ((Number) row[2]).longValue(),
                        (String) row[3],
                        (String) row[4]
                ))
                .toList();
    }
}
