package me.one_org.melody.Services.Api;

import java.util.List;

import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import me.one_org.melody.Entity.PaginationMetaDataEntity;
import me.one_org.melody.Entity.PlaylistsEntity;
import me.one_org.melody.Exceptions.ResourceNotFoundException;
import me.one_org.melody.Repository.PlaylistsRepository;
import me.one_org.melody.Services.General.PaginationMetaDataService;

import org.springframework.transaction.annotation.Transactional;
import me.one_org.melody.Entity.SongsEntity;

@Service
public class PlaylistApiService {

    private final PlaylistsRepository playlistsRepository;
    private final PaginationMetaDataService paginationMetaDataService;

    public PlaylistApiService(PlaylistsRepository playlistsRepository, PaginationMetaDataService paginationMetaDataService) {
        this.playlistsRepository = playlistsRepository;
        this.paginationMetaDataService = paginationMetaDataService;
    }

    public List<PlaylistsEntity> getPlaylistsPaginated(int page, int size) {
        return playlistsRepository.findAllPaginated(page, size);
    }

    public PaginationMetaDataEntity getPaginationMetaData() {
        return paginationMetaDataService.getMetaData("PlaylistsEntity");
    }

    @Cacheable(value = "playlist_lists", key = "'all'")
    public List<PlaylistsEntity> getAllPlaylists() {
        return playlistsRepository.findAll();
    }

    @Cacheable(value = "playlists", key = "#id")
    public PlaylistsEntity getPlaylistById(String id) {
        return playlistsRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Playlist not found with id: " + id));
    }

    @Transactional(readOnly = true)
    public List<SongsEntity> getPlaylistSongsPaginated(String id, int page, int size) {
        getPlaylistById(id);
        return playlistsRepository.findSongsByPlaylistIdPaginated(id, page, size);
    }

    public PaginationMetaDataEntity getPlaylistSongsPaginationMetaData(String id) {
        return paginationMetaDataService.getMetaData("PlaylistSongs_" + id);
    }
}
