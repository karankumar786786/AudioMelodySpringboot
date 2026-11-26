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

/**
 * Listening history aur recent searches ka logic.
 *
 * Service = asli business logic. Controller isko call karta hai, ye repositories (DB), cache aur
 * bahar ki services (Recombee, Algolia) ko use karta hai.
 * @Transactional(readOnly = true) = by default sirf padhne wale DB transactions (thode fast);
 * jo methods data badalte hain un pe alag se @Transactional laga hai.
 * @Cacheable = result Redis me cache hota hai (RedisConfig dekho).
 */
@Service
@Transactional(readOnly = true)
public class UserHistoryApiService {

    private final UserHistoryRepository userHistoryRepository;
    private final UsersRepository usersRepository;
    private final UserSearchHistoryRepository searchHistoryRepository;
    private final SongsRepository songsRepository;
    private final ArtistsRepository artistsRepository;
    private final PlaylistsRepository playlistsRepository;
    private final UserPlaylistsRepository userPlaylistsRepository;

    public UserHistoryApiService(UserHistoryRepository userHistoryRepository,
                                 UsersRepository usersRepository,
                                 UserSearchHistoryRepository searchHistoryRepository,
                                 SongsRepository songsRepository,
                                 ArtistsRepository artistsRepository,
                                 PlaylistsRepository playlistsRepository,
                                 UserPlaylistsRepository userPlaylistsRepository) {
        this.userHistoryRepository = userHistoryRepository;
        this.usersRepository = usersRepository;
        this.searchHistoryRepository = searchHistoryRepository;
        this.songsRepository = songsRepository;
        this.artistsRepository = artistsRepository;
        this.playlistsRepository = playlistsRepository;
        this.userPlaylistsRepository = userPlaylistsRepository;
    }

    /** History page by page. */
    public List<UserHistoryResponseDto> getHistory(String userId, int page, int size) {
        if (userId == null || userId.isBlank() || size <= 0 || page < 0) {
            return java.util.Collections.emptyList();
        }

        User user = usersRepository.getReferenceById(userId);
        List<UserHistory> history = userHistoryRepository.findByUserOrderByListenedAtDesc(user, page, size);
        return history.stream()
                .map(this::mapToDto)
                .toList();
    }

    /** User ke kitne history rows. */
    public PaginationMetaDataDto getPaginationMetaData(String userId) {
        if (userId == null || userId.isBlank()) {
            return null;
        }
        User user = usersRepository.getReferenceById(userId);
        long count = userHistoryRepository.countByUser(user);
        return new PaginationMetaDataDto(
                "meta_user_history_" + userId,
                "UserHistory_" + userId,
                count,
                count,
                0L,
                0L,
                LocalDateTime.now()
        );
    }

    /** Recent searches: sab mila ke + type ke hisaab se. Jo playlist ab private ho gayi, wo entry saaf. */
    public UserSearchHistoryGroupedResponseDto getSearchHistory(String userId) {
        User user = usersRepository.getReferenceById(userId);
        List<UserSearchHistory> histories = searchHistoryRepository.findByUser(user);

        List<UserSearchHistoryItemDto> recentDtos = new ArrayList<>();
        List<SongDto> songs = new ArrayList<>();
        List<ArtistDto> artists = new ArrayList<>();
        List<PlaylistDto> playlists = new ArrayList<>();
        List<UserPlaylistDto> userPlaylists = new ArrayList<>();

        for (UserSearchHistory h : histories) {
            // Playlist ab private hai aur ye user owner nahi - entry hatao aur chhod do
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

    /** Recently played (har gaana ek baar). */
    public List<UserHistoryResponseDto> getRecentlyPlayed(String userId) {
        User user = usersRepository.getReferenceById(userId);
        List<UserHistory> recent = userHistoryRepository.findRecentByUser(user, 10);
        return recent.stream()
                .map(this::mapToDto)
                .toList();
    }

    /**
     * Recent search save karo. Type ke hisaab se sahi cheez honi chahiye; same cheez pehle se ho to
     * purani entry hata ke nayi (taaki upar aaye).
     */
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
            // Sirf public playlist ya apni playlist hi save ho sakti hai
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

    /** Ek recent search hatao (sirf apni). */
    @Transactional
    public void deleteSearchHistoryItem(String userId, String id) {
        User user = usersRepository.getReferenceById(userId);
        searchHistoryRepository.deleteByIdAndUser(id, user);
    }

    /** Saari recent searches hatao. */
    @Transactional
    public void clearSearchHistory(String userId) {
        User user = usersRepository.getReferenceById(userId);
        searchHistoryRepository.deleteByUser(user);
    }


    /** History row -> response DTO. */
    private UserHistoryResponseDto mapToDto(UserHistory history) {
        var song = history.getSong();
        if (song == null) {
            return null;
        }
        Long totalStreams = (song.getSongMetadata() != null && song.getSongMetadata().getTotalStreams() != null)
                ? song.getSongMetadata().getTotalStreams()
                : 0L;
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
                history.getListenedAt(),
                totalStreams
        );
    }
}
