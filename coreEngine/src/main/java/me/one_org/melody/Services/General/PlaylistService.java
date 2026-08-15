package me.one_org.melody.Services.General;

import java.util.HashSet;
import java.util.List;
import java.util.UUID;

import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.Caching;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import me.one_org.melody.AlgoliaSearch.AlgoliaSearch;
import me.one_org.melody.Dto.Controllers.Admin.CreatePlaylistRequestDto;
import me.one_org.melody.Dto.Controllers.Admin.UpdatePlaylistRequestDto;
import me.one_org.melody.Dto.Queue.DeleteEventQueueDto;
import me.one_org.melody.Entity.PaginationMetaDataEntity;
import me.one_org.melody.Entity.PlaylistsEntity;
import me.one_org.melody.Entity.SongsEntity;
import me.one_org.melody.Enums.StatusEnum;
import me.one_org.melody.Exceptions.ExternalServiceException;
import me.one_org.melody.Exceptions.ResourceNotFoundException;
import me.one_org.melody.ImageStorage.ImageKit;
import me.one_org.melody.Queue.DeleteEventQueue;
import me.one_org.melody.Repository.PlaylistsRepository;
import me.one_org.melody.Repository.SongsRepository;

@Service
public class PlaylistService {

    private final PlaylistsRepository playlistsRepository;
    private final SongsRepository songsRepository;
    private final AlgoliaSearch algoliaSearch;
    private final ImageKit imageKit;
    private final PaginationMetaDataService paginationMetaDataService;
    private final DeleteEventQueue deleteEventQueue;

    public PlaylistService(PlaylistsRepository playlistsRepository, SongsRepository songsRepository,
                           AlgoliaSearch algoliaSearch, ImageKit imageKit,
                           PaginationMetaDataService paginationMetaDataService,
                           DeleteEventQueue deleteEventQueue) {
        this.playlistsRepository = playlistsRepository;
        this.songsRepository = songsRepository;
        this.algoliaSearch = algoliaSearch;
        this.imageKit = imageKit;
        this.paginationMetaDataService = paginationMetaDataService;
        this.deleteEventQueue = deleteEventQueue;
    }

    @Transactional
    @CacheEvict(value = "playlist_lists", allEntries = true)
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
            throw new ExternalServiceException("Playlist saved but Algolia sync failed: " + e.getMessage(), e);
        }
        return playlist;
    }

    @Transactional
    @Caching(evict = {
        @CacheEvict(value = "playlists", key = "#id"),
        @CacheEvict(value = "playlist_lists", allEntries = true)
    })
    public PlaylistsEntity updatePlaylist(String id, UpdatePlaylistRequestDto data) {
        PlaylistsEntity playlist = playlistsRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Playlist not found with id: " + id));

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
    @Caching(evict = {
        @CacheEvict(value = "playlists", key = "#id"),
        @CacheEvict(value = "playlist_lists", allEntries = true)
    })
    public void deletePlaylist(String id) {
        PlaylistsEntity playlist = playlistsRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Playlist not found with id: " + id));
        if (playlist.getStatus() == StatusEnum.DELETED) {
            return;
        }
        StatusEnum previousStatus = playlist.getStatus();
        playlist.setStatus(StatusEnum.DELETED);
        playlistsRepository.save(playlist);
        paginationMetaDataService.transitionStatus("PlaylistsEntity", previousStatus, StatusEnum.DELETED);
        deleteEventQueue.queueDeleteEvent(DeleteEventQueueDto.forPlaylist(playlist));
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

    @Transactional
    @Caching(evict = {
        @CacheEvict(value = "playlists", key = "#playlistId"),
        @CacheEvict(value = "playlist_lists", allEntries = true)
    })
    public PlaylistsEntity addSongToPlaylist(String playlistId, String songId) {
        PlaylistsEntity playlist = playlistsRepository.findById(playlistId)
                .orElseThrow(() -> new ResourceNotFoundException("Playlist not found with id: " + playlistId));
        SongsEntity song = songsRepository.findById(songId)
                .orElseThrow(() -> new ResourceNotFoundException("Song not found with id: " + songId));

        if (playlist.getSongs().add(song)) {
            playlistsRepository.save(playlist);
            paginationMetaDataService.incrementStatus("PlaylistSongs_" + playlistId, null);
        }
        return playlist;
    }

    @Transactional
    @Caching(evict = {
        @CacheEvict(value = "playlists", key = "#playlistId"),
        @CacheEvict(value = "playlist_lists", allEntries = true)
    })
    public PlaylistsEntity removeSongFromPlaylist(String playlistId, String songId) {
        PlaylistsEntity playlist = playlistsRepository.findById(playlistId)
                .orElseThrow(() -> new ResourceNotFoundException("Playlist not found with id: " + playlistId));

        if (playlist.getSongs().removeIf(s -> s.getId().equals(songId))) {
            playlistsRepository.save(playlist);
            paginationMetaDataService.decrementStatus("PlaylistSongs_" + playlistId, null);
        }
        return playlist;
    }
}
