package me.one_org.melody.Services.App;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import me.one_org.melody.Entity.PaginationMetaDataEntity;
import me.one_org.melody.Entity.SongsEntity;
import me.one_org.melody.Repository.SongsRepository;
import me.one_org.melody.Services.Genral.PaginationMetaDataService;

@Service
public class SongsAppService {

    private final SongsRepository songsRepository;
    private final PaginationMetaDataService paginationMetaDataService;

    public SongsAppService(SongsRepository songsRepository, PaginationMetaDataService paginationMetaDataService) {
        this.songsRepository = songsRepository;
        this.paginationMetaDataService = paginationMetaDataService;
    }

    public List<SongsEntity> browseSongs(int page, int size) {
        return songsRepository.findAllPaginated(page, size);
    }

    public SongsEntity getSongById(String id) {
        return songsRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Song not found"));
    }

    public PaginationMetaDataEntity getPaginationMetaData() {
        return paginationMetaDataService.getMetaData("SongsEntity");
    }
}
