package me.one_org.melody.Services.Api;

import java.util.List;

import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import me.one_org.melody.Dto.Controllers.Api.PaginationMetaDataDto;
import me.one_org.melody.Dto.Controllers.Api.PlaylistDto;
import me.one_org.melody.Dto.Controllers.Api.SongDto;
import me.one_org.melody.Entity.PaginationMetaData;
import me.one_org.melody.Entity.Playlist;
import me.one_org.melody.Exceptions.ResourceNotFoundException;
import me.one_org.melody.Repository.PlaylistsRepository;
import me.one_org.melody.Services.General.PaginationMetaDataService;

@Service
@Transactional(readOnly = true)
public class PlaylistApiService {

    private final PlaylistsRepository playlistsRepository;
    private final PaginationMetaDataService paginationMetaDataService;

    public PlaylistApiService(PlaylistsRepository playlistsRepository, PaginationMetaDataService paginationMetaDataService) {
        this.playlistsRepository = playlistsRepository;
        this.paginationMetaDataService = paginationMetaDataService;
    }

    public List<PlaylistDto> getPlaylistsPaginated(int page, int size) {
        if (size <= 0 || page < 0) return List.of();

        PaginationMetaData meta = paginationMetaDataService.getMetaData("PlaylistsEntity");
        if (meta != null && meta.getTotalCount() > 0 && (long) page * size >= meta.getTotalCount()) {
            return List.of();
        }

        return playlistsRepository.findAllPaginated(page, size).stream()
                .map(PlaylistDto::fromEntity)
                .toList();
    }

    public PaginationMetaDataDto getPaginationMetaData() {
        PaginationMetaData meta = paginationMetaDataService.getMetaData("PlaylistsEntity");
        return PaginationMetaDataDto.fromEntity(meta);
    }

    @Cacheable(value = "playlist_lists", key = "'all'")
    public List<PlaylistDto> getAllPlaylists() {
        return playlistsRepository.findAllPaginated(0, 100).stream()
                .map(PlaylistDto::fromEntity)
                .toList();
    }

    @Cacheable(value = "playlists", key = "#id")
    public PlaylistDto getPlaylistById(String id) {
        Playlist playlist = playlistsRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Playlist not found with id: " + id));
        return PlaylistDto.fromEntity(playlist);
    }

    public List<SongDto> getPlaylistSongsPaginated(String id, int page, int size) {
        if (id == null || id.isBlank() || size <= 0 || page < 0) return List.of();

        PlaylistDto playlist = getPlaylistById(id);
        if (playlist.totalSongs() > 0 && (long) page * size >= playlist.totalSongs()) {
            return List.of();
        }

        return playlistsRepository.findSongsByPlaylistIdPaginated(id, page, size).stream()
                .map(SongDto::fromEntity)
                .toList();
    }

    public PaginationMetaDataDto getPlaylistSongsPaginationMetaData(String id) {
        PlaylistDto playlist = getPlaylistById(id);
        long count = playlist.totalSongs();
        return new PaginationMetaDataDto(
                "meta_playlist_songs_" + id,
                "PlaylistSongs_" + id,
                count,
                count,
                0L,
                0L,
                java.time.LocalDateTime.now()
        );
    }
}
