package me.one_org.melody.Services.App;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import me.one_org.melody.Entity.PlaylistsEntity;
import me.one_org.melody.Repository.PlaylistsRepository;

@Service
public class PlaylistAppService {

    private final PlaylistsRepository playlistsRepository;

    public PlaylistAppService(PlaylistsRepository playlistsRepository) {
        this.playlistsRepository = playlistsRepository;
    }

    public List<PlaylistsEntity> getAllPlaylists() {
        return playlistsRepository.findAll();
    }

    public PlaylistsEntity getPlaylistById(String id) {
        return playlistsRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Playlist not found"));
    }
}
