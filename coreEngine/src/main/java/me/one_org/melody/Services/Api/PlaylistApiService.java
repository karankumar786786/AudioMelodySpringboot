package me.one_org.melody.Services.Api;

import java.util.List;

import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import me.one_org.melody.Entity.PaginationMetaData;
import me.one_org.melody.Entity.Playlist;
import me.one_org.melody.Entity.Song;
import me.one_org.melody.Exceptions.ResourceNotFoundException;
import me.one_org.melody.Repository.PlaylistsRepository;
import me.one_org.melody.Services.General.PaginationMetaDataService;

@Service
public class PlaylistApiService {

    private final PlaylistsRepository playlistsRepository;
    private final PaginationMetaDataService paginationMetaDataService;

    public PlaylistApiService(PlaylistsRepository playlistsRepository, PaginationMetaDataService paginationMetaDataService) {
        this.playlistsRepository = playlistsRepository;
        this.paginationMetaDataService = paginationMetaDataService;
    }

    public List<Playlist> getPlaylistsPaginated(int page, int size) {
        return playlistsRepository.findAllPaginated(page, size);
    }

    public PaginationMetaData getPaginationMetaData() {
        return paginationMetaDataService.getMetaData("PlaylistsEntity");
    }

    @Cacheable(value = "playlist_lists", key = "'all'")
    public List<Playlist> getAllPlaylists() {
        return playlistsRepository.findAll();
    }

    @Cacheable(value = "playlists", key = "#id")
    public Playlist getPlaylistById(String id) {
        return playlistsRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Playlist not found with id: " + id));
    }

    @Transactional(readOnly = true)
    public List<Song> getPlaylistSongsPaginated(String id, int page, int size) {
        getPlaylistById(id);
        return playlistsRepository.findSongsByPlaylistIdPaginated(id, page, size);
    }

    public PaginationMetaData getPlaylistSongsPaginationMetaData(String id) {
        return paginationMetaDataService.getMetaData("PlaylistSongs_" + id);
    }
}
