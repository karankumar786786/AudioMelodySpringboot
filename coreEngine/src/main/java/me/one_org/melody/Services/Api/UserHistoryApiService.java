package me.one_org.melody.Services.Api;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import me.one_org.melody.Dto.Controllers.Api.SaveSearchHistoryRequestDto;
import me.one_org.melody.Dto.Controllers.Api.UserHistoryResponseDto;
import me.one_org.melody.Dto.Controllers.Api.UserSearchHistoryGroupedResponseDto;
import me.one_org.melody.Dto.Controllers.Api.UserSearchHistoryItemDto;
import me.one_org.melody.Entity.ArtistsEntity;
import me.one_org.melody.Entity.PaginationMetaDataEntity;
import me.one_org.melody.Entity.PlaylistsEntity;
import me.one_org.melody.Entity.SongsEntity;
import me.one_org.melody.Entity.UserHistoryEntity;
import me.one_org.melody.Entity.UserPlaylistsEntity;
import me.one_org.melody.Entity.UserSearchHistoryEntity;
import me.one_org.melody.Entity.UsersEntity;
import me.one_org.melody.Enums.PlaylistPrivacyEnum;
import me.one_org.melody.Repository.ArtistsRepository;
import me.one_org.melody.Repository.PlaylistsRepository;
import me.one_org.melody.Repository.SongsRepository;
import me.one_org.melody.Repository.UserHistoryRepository;
import me.one_org.melody.Repository.UserPlaylistsRepository;
import me.one_org.melody.Repository.UserSearchHistoryRepository;
import me.one_org.melody.Repository.UsersRepository;
import me.one_org.melody.Services.General.PaginationMetaDataService;

@Service
public class UserHistoryApiService {

    private final UserHistoryRepository userHistoryRepository;
    private final UsersRepository usersRepository;
    private final PaginationMetaDataService paginationMetaDataService;
    private final UserSearchHistoryRepository searchHistoryRepository;
    private final SongsRepository songsRepository;
    private final ArtistsRepository artistsRepository;
    private final PlaylistsRepository playlistsRepository;
    private final UserPlaylistsRepository userPlaylistsRepository;

    public UserHistoryApiService(UserHistoryRepository userHistoryRepository,
                                 UsersRepository usersRepository,
                                 PaginationMetaDataService paginationMetaDataService,
                                 UserSearchHistoryRepository searchHistoryRepository,
                                 SongsRepository songsRepository,
                                 ArtistsRepository artistsRepository,
                                 PlaylistsRepository playlistsRepository,
                                 UserPlaylistsRepository userPlaylistsRepository) {
        this.userHistoryRepository = userHistoryRepository;
        this.usersRepository = usersRepository;
        this.paginationMetaDataService = paginationMetaDataService;
        this.searchHistoryRepository = searchHistoryRepository;
        this.songsRepository = songsRepository;
        this.artistsRepository = artistsRepository;
        this.playlistsRepository = playlistsRepository;
        this.userPlaylistsRepository = userPlaylistsRepository;
    }

    public List<UserHistoryResponseDto> getHistory(String userId, int page, int size) {
        UsersEntity user = getUser(userId);
        List<UserHistoryEntity> history = userHistoryRepository.findByUserOrderByListenedAtDesc(user, page, size);
        return history.stream()
                .map(this::mapToDto)
                .toList();
    }

    public PaginationMetaDataEntity getPaginationMetaData(String userId) {
        return paginationMetaDataService.getMetaData("UserHistory_" + userId);
    }

    public UserSearchHistoryGroupedResponseDto getSearchHistory(String userId) {
        UsersEntity user = getUser(userId);
        List<UserSearchHistoryEntity> histories = searchHistoryRepository.findByUser(user);

        List<UserSearchHistoryItemDto> recentDtos = new ArrayList<>();
        List<SongsEntity> songs = new ArrayList<>();
        List<ArtistsEntity> artists = new ArrayList<>();
        List<PlaylistsEntity> playlists = new ArrayList<>();
        List<UserPlaylistsEntity> userPlaylists = new ArrayList<>();

        for (UserSearchHistoryEntity h : histories) {
            // If user playlist is private and viewer is not the owner, delete & skip
            if (h.getUserPlaylist() != null) {
                if (h.getUserPlaylist().getPrivacy() == PlaylistPrivacyEnum.PRIVATE
                        && !h.getUserPlaylist().getUser().getId().equals(userId)) {
                    searchHistoryRepository.deleteByIdAndUser(h.getId(), user);
                    continue;
                }
            }

            String entityType = h.getEntityType() != null ? h.getEntityType() : "SONG";
            UserSearchHistoryItemDto itemDto = new UserSearchHistoryItemDto(
                    h.getId(),
                    entityType,
                    h.getSong(),
                    h.getArtist(),
                    h.getPlaylist(),
                    h.getUserPlaylist(),
                    h.getCreatedAt()
            );
            recentDtos.add(itemDto);

            if (h.getSong() != null && songs.stream().noneMatch(s -> s.getId().equals(h.getSong().getId()))) {
                songs.add(h.getSong());
            } else if (h.getArtist() != null && artists.stream().noneMatch(a -> a.getId().equals(h.getArtist().getId()))) {
                artists.add(h.getArtist());
            } else if (h.getPlaylist() != null && playlists.stream().noneMatch(p -> p.getId().equals(h.getPlaylist().getId()))) {
                playlists.add(h.getPlaylist());
            } else if (h.getUserPlaylist() != null && userPlaylists.stream().noneMatch(up -> up.getId().equals(h.getUserPlaylist().getId()))) {
                userPlaylists.add(h.getUserPlaylist());
            }
        }

        return new UserSearchHistoryGroupedResponseDto(
                recentDtos,
                songs,
                artists,
                playlists,
                userPlaylists
        );
    }

    public List<UserHistoryResponseDto> getRecentlyPlayed(String userId) {
        UsersEntity user = getUser(userId);
        List<UserHistoryEntity> recent = userHistoryRepository.findRecentByUser(user, 10);
        return recent.stream()
                .map(this::mapToDto)
                .toList();
    }

    public void saveSearchHistory(String userId, SaveSearchHistoryRequestDto request) {
        if (request == null) return;
        UsersEntity user = getUser(userId);
        String type = request.type() != null ? request.type().toUpperCase() : null;

        if (type == null) {
            if (request.songId() != null && !request.songId().isBlank()) type = "SONG";
            else if (request.artistId() != null && !request.artistId().isBlank()) type = "ARTIST";
            else if (request.playlistId() != null && !request.playlistId().isBlank()) type = "PLAYLIST";
            else if (request.userPlaylistId() != null && !request.userPlaylistId().isBlank()) type = "USER_PLAYLIST";
            else return;
        }

        UserSearchHistoryEntity.UserSearchHistoryEntityBuilder builder = UserSearchHistoryEntity.builder()
                .id(UUID.randomUUID().toString())
                .user(user)
                .entityType(type)
                .createdAt(LocalDateTime.now());

        if ("SONG".equalsIgnoreCase(type) && request.songId() != null) {
            SongsEntity song = songsRepository.findById(request.songId()).orElse(null);
            if (song == null) return;
            searchHistoryRepository.deleteByUserAndItem(user, "SONG", song.getId());
            builder.song(song);
        } else if ("ARTIST".equalsIgnoreCase(type) && request.artistId() != null) {
            ArtistsEntity artist = artistsRepository.findById(request.artistId()).orElse(null);
            if (artist == null) return;
            searchHistoryRepository.deleteByUserAndItem(user, "ARTIST", artist.getId());
            builder.artist(artist);
        } else if ("PLAYLIST".equalsIgnoreCase(type) && request.playlistId() != null) {
            PlaylistsEntity playlist = playlistsRepository.findById(request.playlistId()).orElse(null);
            if (playlist == null) return;
            searchHistoryRepository.deleteByUserAndItem(user, "PLAYLIST", playlist.getId());
            builder.playlist(playlist);
        } else if ("USER_PLAYLIST".equalsIgnoreCase(type) && request.userPlaylistId() != null) {
            UserPlaylistsEntity userPlaylist = userPlaylistsRepository.findById(request.userPlaylistId()).orElse(null);
            if (userPlaylist == null) return;
            // Only allow saving public user playlists or user's own playlist
            if (userPlaylist.getPrivacy() == PlaylistPrivacyEnum.PRIVATE && !userPlaylist.getUser().getId().equals(userId)) {
                return;
            }
            searchHistoryRepository.deleteByUserAndItem(user, "USER_PLAYLIST", userPlaylist.getId());
            builder.userPlaylist(userPlaylist);
        } else {
            return;
        }

        searchHistoryRepository.save(builder.build());
    }

    public void deleteSearchHistoryItem(String userId, String id) {
        UsersEntity user = getUser(userId);
        searchHistoryRepository.deleteByIdAndUser(id, user);
    }

    public void clearSearchHistory(String userId) {
        UsersEntity user = getUser(userId);
        searchHistoryRepository.deleteByUser(user);
    }

    private UsersEntity getUser(String userId) {
        return usersRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
    }

    private UserHistoryResponseDto mapToDto(UserHistoryEntity history) {
        var song = history.getSong();
        return new UserHistoryResponseDto(
                history.getId(),
                song.getId(),
                song.getTitle(),
                song.getArtistName(),
                song.getDuration(),
                song.getSongKey(),
                song.getImageKey(),
                song.getVideoKey(),
                song.getFullVideoKey(),
                song.isFeatured(),
                song.getLanguage(),
                song.getLrclibId(),
                song.getStatus() != null ? song.getStatus().name() : null,
                song.getCreatedAt(),
                song.getPreviewStartTime(),
                song.getPreviewEndTime(),
                history.getPart(),
                history.getListenedAt()
        );
    }
}
