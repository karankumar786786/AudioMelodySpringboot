package me.one_org.melody.Services.App;

import java.util.List;

import org.springframework.stereotype.Service;

import me.one_org.melody.Entity.ArtistsEntity;
import me.one_org.melody.Entity.PaginationMetaDataEntity;
import me.one_org.melody.Exceptions.ResourceNotFoundException;
import me.one_org.melody.Repository.ArtistsRepository;
import me.one_org.melody.Services.Genral.PaginationMetaDataService;

@Service
public class ArtistAppService {

    private final ArtistsRepository artistsRepository;
    private final PaginationMetaDataService paginationMetaDataService;

    public ArtistAppService(ArtistsRepository artistsRepository, PaginationMetaDataService paginationMetaDataService) {
        this.artistsRepository = artistsRepository;
        this.paginationMetaDataService = paginationMetaDataService;
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

    public ArtistsEntity getArtistById(String id) {
        return artistsRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Artist not found with id: " + id));
    }
}
