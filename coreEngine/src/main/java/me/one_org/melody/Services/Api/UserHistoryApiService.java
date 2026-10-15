package me.one_org.melody.Services.Api;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import me.one_org.melody.Dto.Controllers.Api.ArtistDto;
import me.one_org.melody.Dto.Controllers.Api.PaginationMetaDataDto;
import me.one_org.melody.Dto.Controllers.Api.PlaylistDto;
import me.one_org.melody.Dto.Controllers.Api.SaveSearchHistoryRequestDto;
import me.one_org.melody.Dto.Controllers.Api.SongDto;
import me.one_org.melody.Dto.Controllers.Api.UserHistoryResponseDto;
import me.one_org.melody.Dto.Controllers.Api.UserPlaylistDto;
import me.one_org.melody.Dto.Controllers.Api.UserSearchHistoryGroupedResponseDto;
import me.one_org.melody.Dto.Controllers.Api.UserSearchHistoryItemDto;
import me.one_org.melody.Entity.User;
import me.one_org.melody.Entity.UserHistory;
import me.one_org.melody.Entity.UserPlaylist;
import me.one_org.melody.Entity.UserSearchHistory;
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
@Transactional(readOnly = true)
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
        if (userId == null || userId.isBlank() || size <= 0 || page < 0) {
            return java.util.Collections.emptyList();
        }

        PaginationMetaDataDto meta = getPaginationMetaData(userId);
        if (meta == null || meta.totalCount() == 0 || (long) page * size >= meta.totalCount()) {
            return java.util.Collections.emptyList();
        }

        User user = usersRepository.getReferenceById(userId);
        List<UserHistory> history = userHistoryRepository.findByUserOrderByListenedAtDesc(user, page, size);
        return history.stream()
                .map(this::mapToDto)
                .toList();
    }

    public PaginationMetaDataDto getPaginationMetaData(String userId) {
        return PaginationMetaDataDto.fromEntity(paginationMetaDataService.getMetaData("UserHistory_" + userId));
    }

    public UserSearchHistoryGroupedResponseDto getSearchHistory(String userId) {
        User user = usersRepository.getReferenceById(userId);
        List<UserSearchHistory> histories = searchHistoryRepository.findByUser(user);

        List<UserSearchHistoryItemDto> recentDtos = new ArrayList<>();
        List<SongDto> songs = new ArrayList<>();
        List<ArtistDto> artists = new ArrayList<>();
        List<PlaylistDto> playlists = new ArrayList<>();
        List<UserPlaylistDto> userPlaylists = new ArrayList<>();

        for (UserSearchHistory h : histories) {
            // If user playlist is private and viewer is not the owner, delete & skip
            if (h.getUserPlaylist() != null) {
                if (h.getUserPlaylist().getPrivacy() == PlaylistPrivacyEnum.PRIVATE
                        && !h.getUserPlaylist().getUser().getId().equals(userId)) {
                    searchHistoryRepository.deleteByIdAndUser(h.getId(), user);
                    continue;
                }
            }

            String entityType = h.getEntityType() != null ? h.getEntityType() : "SONG";
            SongDto songDto = SongDto.fromEntity(h.getSong());
            ArtistDto artistDto = ArtistDto.fromEntity(h.getArtist());
            PlaylistDto playlistDto = PlaylistDto.fromEntity(h.getPlaylist());
            UserPlaylistDto userPlaylistDto = UserPlaylistDto.fromEntity(h.getUserPlaylist());

            UserSearchHistoryItemDto itemDto = new UserSearchHistoryItemDto(
                    h.getId(),
                    entityType,
                    songDto,
                    artistDto,
                    playlistDto,
                    userPlaylistDto,
                    h.getCreatedAt()
            );
            recentDtos.add(itemDto);

            if (songDto != null && songs.stream().noneMatch(s -> s.id().equals(songDto.id()))) {
                songs.add(songDto);
            } else if (artistDto != null && artists.stream().noneMatch(a -> a.id().equals(artistDto.id()))) {
                artists.add(artistDto);
            } else if (playlistDto != null && playlists.stream().noneMatch(p -> p.id().equals(playlistDto.id()))) {
                playlists.add(playlistDto);
            } else if (userPlaylistDto != null && userPlaylists.stream().noneMatch(up -> up.id().equals(userPlaylistDto.id()))) {
                userPlaylists.add(userPlaylistDto);
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
        User user = usersRepository.getReferenceById(userId);
        List<UserHistory> recent = userHistoryRepository.findRecentByUser(user, 10);
        return recent.stream()
                .map(this::mapToDto)
                .toList();
    }

    @Transactional
    public void saveSearchHistory(String userId, SaveSearchHistoryRequestDto request) {
        if (request == null) return;
        User user = usersRepository.getReferenceById(userId);
        String type = request.type() != null ? request.type().toUpperCase() : null;

        if (type == null) {
            if (request.songId() != null && !request.songId().isBlank()) type = "SONG";
            else if (request.artistId() != null && !request.artistId().isBlank()) type = "ARTIST";
            else if (request.playlistId() != null && !request.playlistId().isBlank()) type = "PLAYLIST";
            else if (request.userPlaylistId() != null && !request.userPlaylistId().isBlank()) type = "USER_PLAYLIST";
            else return;
        }

        UserSearchHistory.UserSearchHistoryBuilder builder = UserSearchHistory.builder()
                .id(UUID.randomUUID().toString())
                .user(user)
                .entityType(type)
                .createdAt(LocalDateTime.now());

        if ("SONG".equalsIgnoreCase(type) && request.songId() != null) {
            String sid = request.songId().trim();
            if (!songsRepository.existsById(sid)) return;
            searchHistoryRepository.deleteByUserAndItem(user, "SONG", sid);
            builder.song(songsRepository.getReferenceById(sid));
        } else if ("ARTIST".equalsIgnoreCase(type) && request.artistId() != null) {
            String aid = request.artistId().trim();
            if (!artistsRepository.existsById(aid)) return;
            searchHistoryRepository.deleteByUserAndItem(user, "ARTIST", aid);
            builder.artist(artistsRepository.getReferenceById(aid));
        } else if ("PLAYLIST".equalsIgnoreCase(type) && request.playlistId() != null) {
            String pid = request.playlistId().trim();
            if (!playlistsRepository.existsById(pid)) return;
            searchHistoryRepository.deleteByUserAndItem(user, "PLAYLIST", pid);
            builder.playlist(playlistsRepository.getReferenceById(pid));
        } else if ("USER_PLAYLIST".equalsIgnoreCase(type) && request.userPlaylistId() != null) {
            String upid = request.userPlaylistId().trim();
            UserPlaylist userPlaylist = userPlaylistsRepository.findById(upid).orElse(null);
            if (userPlaylist == null) return;
            // Only allow saving public user playlists or user's own playlist
            if (userPlaylist.getPrivacy() == PlaylistPrivacyEnum.PRIVATE && !userPlaylist.getUser().getId().equals(userId)) {
                return;
            }
            searchHistoryRepository.deleteByUserAndItem(user, "USER_PLAYLIST", upid);
            builder.userPlaylist(userPlaylistsRepository.getReferenceById(upid));
        } else {
            return;
        }

        searchHistoryRepository.save(builder.build());
    }

    @Transactional
    public void deleteSearchHistoryItem(String userId, String id) {
        User user = usersRepository.getReferenceById(userId);
        searchHistoryRepository.deleteByIdAndUser(id, user);
    }

    @Transactional
    public void clearSearchHistory(String userId) {
        User user = usersRepository.getReferenceById(userId);
        searchHistoryRepository.deleteByUser(user);
    }


    private UserHistoryResponseDto mapToDto(UserHistory history) {
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
                song.getIsFeatured(),
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
