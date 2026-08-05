package me.one_org.melody.Services.Api;

import java.util.List;
import java.util.Optional;

import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import me.one_org.melody.AlgoliaSearch.AlgoliaSearch;
import me.one_org.melody.Entity.ArtistsEntity;
import me.one_org.melody.Entity.PaginationMetaDataEntity;
import me.one_org.melody.Entity.SongsEntity;
import me.one_org.melody.Exceptions.ResourceNotFoundException;
import me.one_org.melody.Repository.ArtistsRepository;
import me.one_org.melody.Repository.SongsRepository;
import me.one_org.melody.Services.General.PaginationMetaDataService;

@Service
public class ArtistApiService {

    private final ArtistsRepository artistsRepository;
    private final SongsRepository songsRepository;
    private final AlgoliaSearch algoliaSearch;
    private final PaginationMetaDataService paginationMetaDataService;

    public ArtistApiService(ArtistsRepository artistsRepository,
                            SongsRepository songsRepository,
                            AlgoliaSearch algoliaSearch,
                            PaginationMetaDataService paginationMetaDataService) {
        this.artistsRepository = artistsRepository;
        this.songsRepository = songsRepository;
        this.algoliaSearch = algoliaSearch;
        this.paginationMetaDataService = paginationMetaDataService;
    }

    public List<ArtistsEntity> getArtistsPaginated(int page, int size) {
        return artistsRepository.findAllPaginated(page, size);
    }

    public PaginationMetaDataEntity getPaginationMetaData() {
        return paginationMetaDataService.getMetaData("ArtistsEntity");
    }

    @Cacheable(value = "artist_lists", key = "'all'")
    public List<ArtistsEntity> getAllArtists() {
        return artistsRepository.findAll();
    }

    @Cacheable(value = "artists", key = "#id")
    public ArtistsEntity getArtistById(String id) {
        return artistsRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Artist not found with id: " + id));
    }

    public List<SongsEntity> getArtistSongs(String artistIdOrQuery) {
        if (artistIdOrQuery == null || artistIdOrQuery.isBlank()) {
            return List.of();
        }
        String searchQuery = artistIdOrQuery;
        Optional<ArtistsEntity> artistOpt = artistsRepository.findById(artistIdOrQuery);
        if (artistOpt.isPresent()) {
            searchQuery = artistOpt.get().getName();
        }
        List<String> songIds = algoliaSearch.searchSongsByArtist(searchQuery);
        return songsRepository.findAllByIds(songIds);
    }
}
