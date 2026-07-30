package me.one_org.melody.Services.Genral;

import java.util.HashSet;
import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import me.one_org.melody.AlgoliaSearch.AlgoliaSearch;
import me.one_org.melody.Dto.Controllers.Admin.CreatePlaylistRequestDto;
import me.one_org.melody.Dto.Controllers.Admin.UpdatePlaylistRequestDto;
import me.one_org.melody.Entity.PaginationMetaDataEntity;
import me.one_org.melody.Entity.PlaylistsEntity;
import me.one_org.melody.Entity.SongsEntity;
import me.one_org.melody.ImageStorage.ImageKit;
import me.one_org.melody.Repository.PlaylistsRepository;
import me.one_org.melody.Repository.SongsRepository;

@Service
public class PlaylistService {

    private final PlaylistsRepository playlistsRepository;
    private final SongsRepository songsRepository;
    private final AlgoliaSearch algoliaSearch;
    private final ImageKit imageKit;
    private final PaginationMetaDataService paginationMetaDataService;

    public PlaylistService(PlaylistsRepository playlistsRepository, SongsRepository songsRepository,
                           AlgoliaSearch algoliaSearch, ImageKit imageKit,
                           PaginationMetaDataService paginationMetaDataService) {
        this.playlistsRepository = playlistsRepository;
        this.songsRepository = songsRepository;
        this.algoliaSearch = algoliaSearch;
        this.imageKit = imageKit;
        this.paginationMetaDataService = paginationMetaDataService;
    }

    @Transactional
    public PlaylistsEntity createPlaylist(CreatePlaylistRequestDto data) {
        String id = UUID.randomUUID().toString();
        PlaylistsEntity playlist = PlaylistsEntity.builder()
                .id(id)
                .name(data.name())
                .description(data.description())
                .coverImageKey(data.coverImageKey())
                .bannerImageKey(data.bannerImageKey())
                .songs(new HashSet<>())
                .build();
        playlistsRepository.save(playlist);
        paginationMetaDataService.incrementStatus("PlaylistsEntity", playlist.getStatus());

        try {
            algoliaSearch.save(playlist);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Playlist saved but Algolia sync failed: " + e.getMessage());
        }
        return playlist;
    }

    @Transactional
    public PlaylistsEntity updatePlaylist(String id, UpdatePlaylistRequestDto data) {
        PlaylistsEntity playlist = playlistsRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Playlist not found"));

        if (data.name() != null) playlist.setName(data.name());
        if (data.description() != null) playlist.setDescription(data.description());
        if (data.coverImageKey() != null) playlist.setCoverImageKey(data.coverImageKey());
        if (data.bannerImageKey() != null) playlist.setBannerImageKey(data.bannerImageKey());

        playlistsRepository.save(playlist);

        try {
            algoliaSearch.save(playlist);
        } catch (Exception e) {
            // Log but don't fail
        }
        return playlist;
    }

    @Transactional
    public void deletePlaylist(String id) {
        PlaylistsEntity playlist =  playlistsRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Playlist not found"));
        imageKit.deleteByKey(playlist.getBannerImageKey());
        imageKit.deleteByKey(playlist.getCoverImageKey());
        algoliaSearch.delete(id);
        playlistsRepository.deleteById(id);
        paginationMetaDataService.decrementStatus("PlaylistsEntity", playlist.getStatus());
    }

    public PlaylistsEntity getPlaylistById(String id) {
        return playlistsRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Playlist not found"));
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

    @Transactional
    public PlaylistsEntity addSongToPlaylist(String playlistId, String songId) {
        PlaylistsEntity playlist = playlistsRepository.findById(playlistId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Playlist not found"));
        SongsEntity song = songsRepository.findById(songId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Song not found"));

        playlist.getSongs().add(song);
        playlistsRepository.save(playlist);
        return playlist;
    }

    @Transactional
    public PlaylistsEntity removeSongFromPlaylist(String playlistId, String songId) {
        PlaylistsEntity playlist = playlistsRepository.findById(playlistId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Playlist not found"));

        playlist.getSongs().removeIf(s -> s.getId().equals(songId));
        playlistsRepository.save(playlist);
        return playlist;
    }
}
