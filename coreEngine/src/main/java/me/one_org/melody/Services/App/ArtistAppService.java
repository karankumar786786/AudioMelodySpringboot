package me.one_org.melody.Services.App;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import me.one_org.melody.Entity.ArtistsEntity;
import me.one_org.melody.Repository.ArtistsRepository;

@Service
public class ArtistAppService {

    private final ArtistsRepository artistsRepository;

    public ArtistAppService(ArtistsRepository artistsRepository) {
        this.artistsRepository = artistsRepository;
    }

    public List<ArtistsEntity> getAllArtists() {
        return artistsRepository.findAll();
    }

    public ArtistsEntity getArtistById(String id) {
        return artistsRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Artist not found"));
    }
}
