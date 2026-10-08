package me.one_org.melody.Services.Api;

import java.util.List;

import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import me.one_org.melody.Entity.PaginationMetaDataEntity;
import me.one_org.melody.Entity.SongsEntity;
import me.one_org.melody.Exceptions.ResourceNotFoundException;
import me.one_org.melody.Repository.SongsRepository;
import me.one_org.melody.Services.General.PaginationMetaDataService;

@Service
public class SongsApiService {

    private final SongsRepository songsRepository;
    private final PaginationMetaDataService paginationMetaDataService;

    public SongsApiService(SongsRepository songsRepository, PaginationMetaDataService paginationMetaDataService) {
        this.songsRepository = songsRepository;
        this.paginationMetaDataService = paginationMetaDataService;
    }

    public List<SongsEntity> browseSongs(int page, int size) {
        return songsRepository.findAllPaginated(page, size);
    }

    public List<SongsEntity> getTrendingSongs(int limit) {
        return songsRepository.findTrending(limit);
    }

    @Cacheable(value = "songs", key = "#id")
    public SongsEntity getSongById(String id) {
        return songsRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Song not found with id: " + id));
    }

    public PaginationMetaDataEntity getPaginationMetaData() {
        return paginationMetaDataService.getMetaData("SongsEntity");
    }

    @Cacheable(value = "featured_songs", key = "'all'")
    public List<SongsEntity> getFeaturedSongs() {
        return songsRepository.findFeatured();
    }

    public List<SongsEntity> getSongsByAlbum(String albumName) {
        return songsRepository.findByAlbum(albumName);
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
