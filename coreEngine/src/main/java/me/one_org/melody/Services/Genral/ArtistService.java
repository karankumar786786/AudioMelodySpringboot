package me.one_org.melody.Services.Genral;

import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import me.one_org.melody.AlgoliaSearch.AlgoliaSearch;
import me.one_org.melody.Dto.Controllers.Admin.CreateArtistRequestDto;
import me.one_org.melody.Dto.Controllers.Admin.UpdateArtistRequestDto;
import me.one_org.melody.Entity.ArtistsEntity;
import me.one_org.melody.Entity.PaginationMetaDataEntity;
import me.one_org.melody.Exceptions.ExternalServiceException;
import me.one_org.melody.Exceptions.ResourceNotFoundException;
import me.one_org.melody.ImageStorage.ImageKit;
import me.one_org.melody.Repository.ArtistsRepository;

@Service
public class ArtistService {

    private final ArtistsRepository artistsRepository;
    private final AlgoliaSearch algoliaSearch;
    private final ImageKit imageKit;
    private final PaginationMetaDataService paginationMetaDataService;

    public ArtistService(ArtistsRepository artistsRepository, AlgoliaSearch algoliaSearch,
                         ImageKit imageKit, PaginationMetaDataService paginationMetaDataService) {
        this.artistsRepository = artistsRepository;
        this.algoliaSearch = algoliaSearch;
        this.imageKit = imageKit;
        this.paginationMetaDataService = paginationMetaDataService;
    }

    @Transactional
    public ArtistsEntity createArtist(CreateArtistRequestDto data) {
        String id = UUID.randomUUID().toString();
        ArtistsEntity artist = ArtistsEntity.builder()
                .id(id)
                .name(data.name())
                .about(data.about())
                .coverImageKey(data.coverImageKey())
                .bannerImageKey(data.bannerImageKey())
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
    public ArtistsEntity updateArtist(String id, UpdateArtistRequestDto data) {
        ArtistsEntity artist = artistsRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Artist not found with id: " + id));
        String oldCoverImageKey = "";
        String oldBannerImageKey = "";
        if (data.name() != null)
            artist.setName(data.name());
        if (data.about() != null)
            artist.setAbout(data.about());
        if (data.coverImageKey() != null) {
            oldCoverImageKey = artist.getCoverImageKey();
            artist.setCoverImageKey(data.coverImageKey());
        }
        if (data.bannerImageKey() != null) {
            oldBannerImageKey = artist.getBannerImageKey();
            artist.setBannerImageKey(data.bannerImageKey());
        }
        artistsRepository.save(artist);
        imageKit.deleteByKey(oldBannerImageKey);
        imageKit.deleteByKey(oldCoverImageKey);
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
    public void deleteArtist(String id) {
        ArtistsEntity artist = artistsRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Artist not found with id: " + id));
        imageKit.deleteByKey(artist.getBannerImageKey());
        imageKit.deleteByKey(artist.getCoverImageKey());
        algoliaSearch.delete(id);
        artistsRepository.deleteById(id);
        paginationMetaDataService.decrementStatus("ArtistsEntity", artist.getStatus());
    }

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

    public List<ArtistsEntity> getAllArtists() {
        return artistsRepository.findAll();
    }
}
