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

@Service
@Transactional(readOnly = true)
public class SongsApiService {

    private final SongsRepository songsRepository;
    private final PaginationMetaDataService paginationMetaDataService;

    public SongsApiService(SongsRepository songsRepository, PaginationMetaDataService paginationMetaDataService) {
        this.songsRepository = songsRepository;
        this.paginationMetaDataService = paginationMetaDataService;
    }

    public List<SongDto> browseSongs(int page, int size) {
        if (size <= 0 || page < 0) return List.of();

        // Early guard against out-of-bounds page requests via cached Redis metadata
        PaginationMetaData meta = paginationMetaDataService.getMetaData("SongsEntity");
        if (meta != null && meta.getTotalCount() > 0 && (long) page * size >= meta.getTotalCount()) {
            return List.of();
        }

        return songsRepository.findAllPaginated(page, size).stream()
                .map(SongDto::fromEntity)
                .toList();
    }

    public List<SongDto> getTrendingSongs(int limit) {
        return songsRepository.findTrending(limit).stream()
                .map(SongDto::fromEntity)
                .toList();
    }

    @Cacheable(value = "songs", key = "#id")
    public SongDto getSongById(String id) {
        Song song = songsRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Song not found with id: " + id));
        return SongDto.fromEntity(song);
    }

    public PaginationMetaDataDto getPaginationMetaData() {
        PaginationMetaData meta = paginationMetaDataService.getMetaData("SongsEntity");
        return PaginationMetaDataDto.fromEntity(meta);
    }

    @Cacheable(value = "featured_songs", key = "'all'")
    public List<SongDto> getFeaturedSongs() {
        return songsRepository.findFeatured().stream()
                .map(SongDto::fromEntity)
                .toList();
    }

    public List<SongDto> getSongsByAlbum(String albumName) {
        return songsRepository.findByAlbum(albumName).stream()
                .map(SongDto::fromEntity)
                .toList();
    }

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
