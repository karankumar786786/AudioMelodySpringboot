package me.one_org.melody.Services.Admin;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import me.one_org.melody.AlgoliaSearch.AlgoliaSearch;
import me.one_org.melody.Dto.Controllers.Admin.CreateArtistRequestDto;
import me.one_org.melody.Dto.Controllers.Admin.UpdateArtistRequestDto;
import me.one_org.melody.Entity.ArtistsEntity;
import me.one_org.melody.Repository.ArtistsRepository;

@Service
public class ArtistService {

    private final ArtistsRepository artistsRepository;
    private final AlgoliaSearch algoliaSearch;

    public ArtistService(ArtistsRepository artistsRepository, AlgoliaSearch algoliaSearch) {
        this.artistsRepository = artistsRepository;
        this.algoliaSearch = algoliaSearch;
    }

    @Transactional
    public ArtistsEntity createArtist(CreateArtistRequestDto data) {
        ArtistsEntity artist = ArtistsEntity.builder()
                .id(data.id())
                .name(data.name())
                .about(data.about())
                .coverImageKey(data.coverImageKey())
                .bannerImageKey(data.bannerImageKey())
                .build();
        artistsRepository.save(artist);

        // Sync to Algolia
        try {
            algoliaSearch.save(artist);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Artist saved but Algolia sync failed: " + e.getMessage());
        }
        return artist;
    }

    @Transactional
    public ArtistsEntity updateArtist(String id, UpdateArtistRequestDto data) {
        ArtistsEntity artist = artistsRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Artist not found"));

        if (data.name() != null) artist.setName(data.name());
        if (data.about() != null) artist.setAbout(data.about());
        if (data.coverImageKey() != null) artist.setCoverImageKey(data.coverImageKey());
        if (data.bannerImageKey() != null) artist.setBannerImageKey(data.bannerImageKey());

        artistsRepository.save(artist);

        // Sync to Algolia
        try {
            algoliaSearch.save(artist);
        } catch (Exception e) {
            // Log but don't fail the update
        }
        return artist;
    }

    @Transactional
    public void deleteArtist(String id) {
        artistsRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Artist not found"));
        algoliaSearch.delete(id);
        artistsRepository.deleteById(id);
    }

    public ArtistsEntity getArtistById(String id) {
        return artistsRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Artist not found"));
    }

    public List<ArtistsEntity> getAllArtists() {
        return artistsRepository.findAll();
    }
}
