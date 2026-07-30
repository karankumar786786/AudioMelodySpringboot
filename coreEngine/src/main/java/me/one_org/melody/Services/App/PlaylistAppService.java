package me.one_org.melody.Services.App;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import me.one_org.melody.Entity.PaginationMetaDataEntity;
import me.one_org.melody.Entity.PlaylistsEntity;
import me.one_org.melody.Repository.PlaylistsRepository;
import me.one_org.melody.Services.Genral.PaginationMetaDataService;

@Service
public class PlaylistAppService {

    private final PlaylistsRepository playlistsRepository;
    private final PaginationMetaDataService paginationMetaDataService;

    public PlaylistAppService(PlaylistsRepository playlistsRepository, PaginationMetaDataService paginationMetaDataService) {
        this.playlistsRepository = playlistsRepository;
        this.paginationMetaDataService = paginationMetaDataService;
    }

    public List<PlaylistsEntity> getPlaylistsPaginated(int page, int size) {
        return playlistsRepository.findAllPaginated(page, size);
    }

    public PaginationMetaDataEntity getPaginationMetaData() {
        return paginationMetaDataService.getMetaData("PlaylistsEntity");
    }

    public List<PlaylistsEntity> getAllPlaylists() {
        return playlistsRepository.findAll();
    }

    public PlaylistsEntity getPlaylistById(String id) {
        return playlistsRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Playlist not found"));
    }
}
