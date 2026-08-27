package me.one_org.melody.Services.General;

import java.util.List;
import java.util.UUID;

import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.Caching;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import me.one_org.melody.AlgoliaSearch.AlgoliaSearch;
import me.one_org.melody.Dto.Controllers.Admin.CreateArtistRequestDto;
import me.one_org.melody.Dto.Controllers.Admin.UpdateArtistRequestDto;
import me.one_org.melody.Dto.Queue.DeleteEventQueueDto;
import me.one_org.melody.Entity.ArtistsEntity;
import me.one_org.melody.Entity.PaginationMetaDataEntity;
import me.one_org.melody.Enums.StatusEnum;
import me.one_org.melody.Exceptions.ExternalServiceException;
import me.one_org.melody.Exceptions.ResourceNotFoundException;
import me.one_org.melody.ImageStorage.ImageKit;
import me.one_org.melody.Queue.DeleteEventQueue;
import me.one_org.melody.Repository.ArtistsRepository;

@Service
public class ArtistService {

    private final ArtistsRepository artistsRepository;
    private final AlgoliaSearch algoliaSearch;
    private final ImageKit imageKit;
    private final PaginationMetaDataService paginationMetaDataService;
    private final DeleteEventQueue deleteEventQueue;

    public ArtistService(ArtistsRepository artistsRepository, AlgoliaSearch algoliaSearch,
                         ImageKit imageKit, PaginationMetaDataService paginationMetaDataService,
                         DeleteEventQueue deleteEventQueue) {
        this.artistsRepository = artistsRepository;
        this.algoliaSearch = algoliaSearch;
        this.imageKit = imageKit;
        this.paginationMetaDataService = paginationMetaDataService;
        this.deleteEventQueue = deleteEventQueue;
    }

    @Transactional
    @CacheEvict(value = "artist_lists", allEntries = true)
    public ArtistsEntity createArtist(CreateArtistRequestDto data) {
        String id = UUID.randomUUID().toString();
        ArtistsEntity artist = ArtistsEntity.builder()
                .id(id)
                .name(data.name())
                .about(data.about())
                .coverImageKey(data.coverImageKey())
                .build();
        artistsRepository.save(artist);
        paginationMetaDataService.incrementStatus("ArtistsEntity", artist.getStatus());
        try {
            algoliaSearch.save(artist);
        } catch (Exception e) {
            throw new ExternalServiceException("Artist saved but Algolia sync failed: " + e.getMessage(), e);
        }
        return artist;
    }

    @Transactional
    @Caching(evict = {
        @CacheEvict(value = "artists", key = "#id"),
        @CacheEvict(value = "artist_lists", allEntries = true)
    })
    public ArtistsEntity updateArtist(String id, UpdateArtistRequestDto data) {
        ArtistsEntity artist = artistsRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Artist not found with id: " + id));
        String oldCoverImageKey = null;
        if (data.name() != null)
            artist.setName(data.name());
        if (data.about() != null)
            artist.setAbout(data.about());
        if (data.coverImageKey() != null && !data.coverImageKey().isBlank() && !data.coverImageKey().equals(artist.getCoverImageKey())) {
            oldCoverImageKey = artist.getCoverImageKey();
            artist.setCoverImageKey(data.coverImageKey());
        }
        artistsRepository.save(artist);
        if (oldCoverImageKey != null && !oldCoverImageKey.isBlank()) {
            try {
                imageKit.deleteByKey(oldCoverImageKey);
            } catch (Exception ignored) {}
        }
        if (data.name() != null) {
            try {
                algoliaSearch.save(artist);
            } catch (Exception e) {
                // Log but don't fail update
            }
        }
        return artist;
    }

    @Transactional
    @Caching(evict = {
        @CacheEvict(value = "artists", key = "#id"),
        @CacheEvict(value = "artist_lists", allEntries = true)
    })
    public void deleteArtist(String id) {
        ArtistsEntity artist = artistsRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Artist not found with id: " + id));
        if (artist.getStatus() == StatusEnum.DELETED) {
            return;
        }
        StatusEnum previousStatus = artist.getStatus();
        artist.setStatus(StatusEnum.DELETED);
        artistsRepository.save(artist);
        paginationMetaDataService.transitionStatus("ArtistsEntity", previousStatus, StatusEnum.DELETED);
        deleteEventQueue.queueDeleteEvent(DeleteEventQueueDto.forArtist(artist));
    }

    @Cacheable(value = "artists", key = "#id")
    public ArtistsEntity getArtistById(String id) {
        return artistsRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Artist not found with id: " + id));
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
}
