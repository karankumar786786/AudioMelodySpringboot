package me.one_org.melody.Services.Webhook;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import me.one_org.melody.AlgoliaSearch.AlgoliaSearch;
import me.one_org.melody.Entity.ArtistsEntity;
import me.one_org.melody.Entity.PlaylistsEntity;
import me.one_org.melody.Entity.SongsEntity;
import me.one_org.melody.Enums.DeleteEntityType;
import me.one_org.melody.Enums.StatusEnum;
import me.one_org.melody.Exceptions.ResourceNotFoundException;
import me.one_org.melody.ImageStorage.ImageKit;
import me.one_org.melody.Recommendation.Recombee;
import me.one_org.melody.Repository.ArtistsRepository;
import me.one_org.melody.Repository.PlaylistsRepository;
import me.one_org.melody.Repository.SongsRepository;
import me.one_org.melody.Services.General.PaginationMetaDataService;

@Service
public class WebhookDeleteService {

    private final SongsRepository songsRepository;
    private final PlaylistsRepository playlistsRepository;
    private final ArtistsRepository artistsRepository;
    private final AlgoliaSearch algoliaSearch;
    private final Recombee recombee;
    private final ImageKit imageKit;
    private final PaginationMetaDataService paginationMetaDataService;

    public WebhookDeleteService(
            SongsRepository songsRepository,
            PlaylistsRepository playlistsRepository,
            ArtistsRepository artistsRepository,
            AlgoliaSearch algoliaSearch,
            Recombee recombee,
            ImageKit imageKit,
            PaginationMetaDataService paginationMetaDataService) {
        this.songsRepository = songsRepository;
        this.playlistsRepository = playlistsRepository;
        this.artistsRepository = artistsRepository;
        this.algoliaSearch = algoliaSearch;
        this.recombee = recombee;
        this.imageKit = imageKit;
        this.paginationMetaDataService = paginationMetaDataService;
    }

    public void deleteSearch(String entityType, String entityId) {
        parseEntityType(entityType);
        try {
            algoliaSearch.delete(entityId);
        } catch (Exception ignored) {
        }
    }

    public void deleteRecommendation(String entityType, String entityId) {
        DeleteEntityType type = parseEntityType(entityType);
        if (type != DeleteEntityType.SONG) {
            return;
        }
        try {
            recombee.delete(entityId);
        } catch (Exception ignored) {
        }
    }

    public void deleteImageKit(String entityType, String entityId) {
        DeleteEntityType type = parseEntityType(entityType);
        switch (type) {
            case SONG -> deleteSongImage(entityId);
            case PLAYLIST -> deletePlaylistImages(entityId);
            case ARTIST -> deleteArtistImages(entityId);
        }
    }

    @Transactional
    public void hardDelete(String entityType, String entityId) {
        DeleteEntityType type = parseEntityType(entityType);
        switch (type) {
            case SONG -> hardDeleteSong(entityId);
            case PLAYLIST -> hardDeletePlaylist(entityId);
            case ARTIST -> hardDeleteArtist(entityId);
        }
    }

    private DeleteEntityType parseEntityType(String entityType) {
        try {
            return DeleteEntityType.valueOf(entityType.trim().toUpperCase());
        } catch (Exception e) {
            throw new ResourceNotFoundException("Unsupported delete entity type: " + entityType);
        }
    }

    private void deleteSongImage(String entityId) {
        SongsEntity song = songsRepository.findById(entityId)
                .orElseThrow(() -> new ResourceNotFoundException("Song not found with id: " + entityId));
        if (song.getImageKey() != null && !song.getImageKey().isBlank()) {
            imageKit.deleteByKey(song.getImageKey());
        }
        if (song.getVideoKey() != null && !song.getVideoKey().isBlank()) {
            imageKit.deleteByKey(song.getVideoKey());
        }
    }

    private void deletePlaylistImages(String entityId) {
        PlaylistsEntity playlist = playlistsRepository.findById(entityId)
                .orElseThrow(() -> new ResourceNotFoundException("Playlist not found with id: " + entityId));
        if (playlist.getCoverImageKey() != null && !playlist.getCoverImageKey().isBlank()) {
            imageKit.deleteByKey(playlist.getCoverImageKey());
        }
        if (playlist.getVideoKey() != null && !playlist.getVideoKey().isBlank()) {
            imageKit.deleteByKey(playlist.getVideoKey());
        }
    }

    private void deleteArtistImages(String entityId) {
        ArtistsEntity artist = artistsRepository.findById(entityId)
                .orElseThrow(() -> new ResourceNotFoundException("Artist not found with id: " + entityId));
        if (artist.getCoverImageKey() != null && !artist.getCoverImageKey().isBlank()) {
            imageKit.deleteByKey(artist.getCoverImageKey());
        }
    }

    private void hardDeleteSong(String entityId) {
        SongsEntity song = songsRepository.findById(entityId)
                .orElseThrow(() -> new ResourceNotFoundException("Song not found with id: " + entityId));
        songsRepository.deleteById(entityId);
        paginationMetaDataService.decrementStatus(DeleteEntityType.SONG.metadataEntityName(),
                song.getStatus() == null ? StatusEnum.ACTIVE : song.getStatus());
    }

    private void hardDeletePlaylist(String entityId) {
        PlaylistsEntity playlist = playlistsRepository.findById(entityId)
                .orElseThrow(() -> new ResourceNotFoundException("Playlist not found with id: " + entityId));
        playlistsRepository.deleteById(entityId);
        paginationMetaDataService.decrementStatus(DeleteEntityType.PLAYLIST.metadataEntityName(),
                playlist.getStatus() == null ? StatusEnum.ACTIVE : playlist.getStatus());
    }

    private void hardDeleteArtist(String entityId) {
        ArtistsEntity artist = artistsRepository.findById(entityId)
                .orElseThrow(() -> new ResourceNotFoundException("Artist not found with id: " + entityId));
        artistsRepository.deleteById(entityId);
        paginationMetaDataService.decrementStatus(DeleteEntityType.ARTIST.metadataEntityName(),
                artist.getStatus() == null ? StatusEnum.ACTIVE : artist.getStatus());
    }
}