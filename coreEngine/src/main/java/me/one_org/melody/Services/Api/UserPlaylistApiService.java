package me.one_org.melody.Services.Api;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import lombok.extern.slf4j.Slf4j;
import me.one_org.melody.Dto.Controllers.Api.PaginationMetaDataDto;
import me.one_org.melody.Dto.Controllers.Api.SongDto;
import me.one_org.melody.Dto.Controllers.Api.UserPlaylistDto;
import me.one_org.melody.Entity.Song;
import me.one_org.melody.Entity.User;
import me.one_org.melody.Entity.UserPlaylist;
import me.one_org.melody.Entity.UserSavedPlaylist;
import me.one_org.melody.Enums.PlaylistPrivacyEnum;
import me.one_org.melody.Repository.SongsRepository;
import me.one_org.melody.Repository.UserPlaylistsRepository;
import me.one_org.melody.Repository.UserSavedPlaylistsRepository;
import me.one_org.melody.Repository.UserSearchHistoryRepository;
import me.one_org.melody.Repository.UsersRepository;
import me.one_org.melody.Services.General.PaginationMetaDataService;

import org.springframework.context.ApplicationEventPublisher;
import me.one_org.melody.Events.AlgoliaEvents;
import me.one_org.melody.Events.TelemetryEvents;

@Service
@Slf4j
public class UserPlaylistApiService {

    private final UserPlaylistsRepository userPlaylistsRepository;
    private final UserSavedPlaylistsRepository userSavedPlaylistsRepository;
    private final UserSearchHistoryRepository userSearchHistoryRepository;
    private final SongsRepository songsRepository;
    private final UsersRepository usersRepository;
    private final PaginationMetaDataService paginationMetaDataService;
    private final ApplicationEventPublisher eventPublisher;

    public UserPlaylistApiService(UserPlaylistsRepository userPlaylistsRepository,
            UserSavedPlaylistsRepository userSavedPlaylistsRepository,
            UserSearchHistoryRepository userSearchHistoryRepository,
            SongsRepository songsRepository, UsersRepository usersRepository,
            PaginationMetaDataService paginationMetaDataService,
            ApplicationEventPublisher eventPublisher) {
        this.userPlaylistsRepository = userPlaylistsRepository;
        this.userSavedPlaylistsRepository = userSavedPlaylistsRepository;
        this.userSearchHistoryRepository = userSearchHistoryRepository;
        this.songsRepository = songsRepository;
        this.usersRepository = usersRepository;
        this.paginationMetaDataService = paginationMetaDataService;
        this.eventPublisher = eventPublisher;
    }

    @Transactional(readOnly = true)
    public List<UserPlaylistDto> getUserPlaylists(String userId) {
        User user = usersRepository.getReferenceById(userId);
        List<UserPlaylist> owned = userPlaylistsRepository.findByUser(user);
        List<UserPlaylist> saved = userSavedPlaylistsRepository.findSavedPlaylistsByUserId(userId);

        List<UserPlaylist> combined = new ArrayList<>(owned);
        for (UserPlaylist sp : saved) {
            if (combined.stream().noneMatch(p -> p.getId().equals(sp.getId()))) {
                combined.add(sp);
            }
        }
        return combined.stream().map(UserPlaylistDto::fromEntity).toList();
    }

    @Transactional(readOnly = true)
    public List<UserPlaylistDto> getUserPlaylistsPaginated(String userId, int page, int size) {
        if (userId == null || userId.isBlank() || size <= 0 || page < 0) {
            return List.of();
        }

        User user = usersRepository.getReferenceById(userId);
        return userPlaylistsRepository.findByUserPaginated(user, page, size).stream()
                .map(UserPlaylistDto::fromEntity)
                .toList();
    }

    public PaginationMetaDataDto getPaginationMetaData(String userId) {
        if (userId == null || userId.isBlank()) {
            return null;
        }
        User user = usersRepository.getReferenceById(userId);
        long count = userPlaylistsRepository.countByUser(user);
        return new PaginationMetaDataDto(
                "meta_user_playlists_" + userId,
                "UserPlaylists_" + userId,
                count,
                count,
                0L,
                0L,
                LocalDateTime.now()
        );
    }

    @Transactional
    public UserPlaylistDto createPlaylist(String userId, String name, PlaylistPrivacyEnum privacy) {
        User user = usersRepository.getReferenceById(userId);
        PlaylistPrivacyEnum chosenPrivacy = privacy != null ? privacy : PlaylistPrivacyEnum.PRIVATE;
        String shareToken = UUID.randomUUID().toString().replace("-", "");

        UserPlaylist playlist = UserPlaylist.builder()
                .id(UUID.randomUUID().toString())
                .name(name)
                .privacy(chosenPrivacy)
                .shareToken(shareToken)
                .user(user)
                .totalSongs(0)
                .songs(new ArrayList<>())
                .build();
        userPlaylistsRepository.save(playlist);
        paginationMetaDataService.incrementStatus("UserPlaylists_" + userId, null);

        // If public, sync to Algolia AFTER_COMMIT
        if (playlist.getPrivacy() == PlaylistPrivacyEnum.PUBLIC) {
            eventPublisher.publishEvent(new AlgoliaEvents.PlaylistIndexSyncEvent(playlist.getId(), playlist.getName()));
        }

        return UserPlaylistDto.fromEntity(playlist);
    }

    @Transactional
    public UserPlaylistDto renamePlaylist(String userId, String playlistId, String name) {
        UserPlaylist playlist = getPlaylistOwnedBy(userId, playlistId);
        playlist.setName(name);
        userPlaylistsRepository.save(playlist);

        // If public, sync to Algolia AFTER_COMMIT
        if (playlist.getPrivacy() == PlaylistPrivacyEnum.PUBLIC) {
            eventPublisher.publishEvent(new AlgoliaEvents.PlaylistIndexSyncEvent(playlist.getId(), playlist.getName()));
        }

        return UserPlaylistDto.fromEntity(playlist);
    }

    @Transactional
    public UserPlaylistDto updatePlaylistPrivacy(String userId, String playlistId, PlaylistPrivacyEnum privacy) {
        UserPlaylist playlist = getPlaylistOwnedBy(userId, playlistId);
        PlaylistPrivacyEnum newPrivacy = privacy != null ? privacy : PlaylistPrivacyEnum.PRIVATE;
        playlist.setPrivacy(newPrivacy);
        if (playlist.getShareToken() == null || playlist.getShareToken().isBlank()) {
            playlist.setShareToken(UUID.randomUUID().toString().replace("-", ""));
        }
        userPlaylistsRepository.save(playlist);

        // Algolia & Followers Sync:
        // If public -> index in Algolia AFTER_COMMIT.
        // If private or share by link -> delete all follower library references AND delete from Algolia AFTER_COMMIT.
        final String pid = playlist.getId();
        if (newPrivacy == PlaylistPrivacyEnum.PUBLIC) {
            eventPublisher.publishEvent(new AlgoliaEvents.PlaylistIndexSyncEvent(playlist.getId(), playlist.getName()));
        } else {
            // Revoke followers: delete saved references from all other users' libraries
            try {
                userSavedPlaylistsRepository.deleteByPlaylist(playlist);
            } catch (Exception e) {
                log.warn("Failed to delete follower references for non-public playlist: {}", e.getMessage());
            }

            // Revoke search history: delete from userSearchHistory
            try {
                userSearchHistoryRepository.deleteByUserPlaylist(playlist);
            } catch (Exception e) {
                log.warn("Failed to delete search history for non-public playlist: {}", e.getMessage());
            }

            // Revoke search index: delete from Algolia AFTER_COMMIT
            eventPublisher.publishEvent(new AlgoliaEvents.PlaylistIndexDeleteEvent(pid));
        }

        return UserPlaylistDto.fromEntity(playlist);
    }

    @Transactional
    public void deletePlaylist(String userId, String playlistId) {
        UserPlaylist playlist = getPlaylistOwnedBy(userId, playlistId);
        
        // Delete all follower references
        try {
            userSavedPlaylistsRepository.deleteByPlaylist(playlist);
        } catch (Exception e) {
            log.warn("Failed to delete follower references for deleted playlist: {}", e.getMessage());
        }

        // Delete from search history
        try {
            userSearchHistoryRepository.deleteByUserPlaylistId(playlistId);
        } catch (Exception e) {
            log.warn("Failed to delete search history for deleted playlist: {}", e.getMessage());
        }

        userPlaylistsRepository.deletePlaylistByIdCascade(playlistId);
        paginationMetaDataService.decrementStatus("UserPlaylists_" + userId, null);

        // Delete from Algolia search index AFTER_COMMIT
        eventPublisher.publishEvent(new AlgoliaEvents.PlaylistIndexDeleteEvent(playlistId));
    }

    @Transactional
    public UserPlaylistDto addSong(String userId, String playlistId, String songId) {
        UserPlaylist playlist = getPlaylistOwnedBy(userId, playlistId);
        if (!songsRepository.existsById(songId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Song not found");
        }

        boolean added = userPlaylistsRepository.addSongToPlaylist(playlistId, songId);
        if (added) {
            playlist.setTotalSongs(playlist.getTotalSongs() + 1);
            paginationMetaDataService.incrementStatus("UserPlaylistSongs_" + playlistId, null);
        }

        // Track in Recombee AFTER_COMMIT
        eventPublisher.publishEvent(new TelemetryEvents.PlaylistSongEvent(userId, songId, true));

        return UserPlaylistDto.fromEntity(playlist);
    }

    @Transactional(readOnly = true)
    public UserPlaylistDto getPlaylistById(String userId, String playlistId) {
        UserPlaylist playlist = userPlaylistsRepository.findById(playlistId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Playlist not found"));
        if (playlist.getPrivacy() != PlaylistPrivacyEnum.PUBLIC) {
            if (userId == null || !playlist.getUser().getId().equals(userId)) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not your playlist");
            }
        }
        return UserPlaylistDto.fromEntity(playlist);
    }

    @Transactional(readOnly = true)
    public List<SongDto> getPlaylistSongsPaginated(String userId, String playlistId, int page, int size) {
        if (playlistId == null || playlistId.isBlank() || size <= 0 || page < 0) {
            return List.of();
        }
        UserPlaylistDto playlist = getPlaylistById(userId, playlistId);
        if (playlist.totalSongs() > 0 && (long) page * size >= playlist.totalSongs()) {
            return List.of();
        }

        return userPlaylistsRepository.findSongsByUserPlaylistIdPaginated(playlistId, page, size).stream()
                .map(SongDto::fromEntity)
                .toList();
    }

    public PaginationMetaDataDto getPlaylistSongsPaginationMetaData(String playlistId) {
        UserPlaylist playlist = userPlaylistsRepository.findById(playlistId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Playlist not found"));
        long count = playlist.getTotalSongs();
        return new PaginationMetaDataDto(
                "meta_user_playlist_songs_" + playlistId,
                "UserPlaylistSongs_" + playlistId,
                count,
                count,
                0L,
                0L,
                LocalDateTime.now()
        );
    }

    @Transactional(readOnly = true)
    public UserPlaylistDto getSharedPlaylist(String tokenOrId, String callerUserId) {
        UserPlaylist playlist = userPlaylistsRepository.findByIdOrShareToken(tokenOrId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Playlist not found"));

        if (playlist.getPrivacy() == PlaylistPrivacyEnum.PRIVATE) {
            if (callerUserId == null || !playlist.getUser().getId().equals(callerUserId)) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "This playlist is private");
            }
        }
        return UserPlaylistDto.fromEntity(playlist);
    }

    @Transactional(readOnly = true)
    public List<SongDto> getSharedPlaylistSongsPaginated(String tokenOrId, String callerUserId, int page, int size) {
        if (tokenOrId == null || tokenOrId.isBlank() || size <= 0 || page < 0) {
            return List.of();
        }
        UserPlaylistDto playlist = getSharedPlaylist(tokenOrId, callerUserId);
        if (playlist.totalSongs() > 0 && (long) page * size >= playlist.totalSongs()) {
            return List.of();
        }

        return userPlaylistsRepository.findSongsByUserPlaylistIdPaginated(playlist.id(), page, size).stream()
                .map(SongDto::fromEntity)
                .toList();
    }

    @Transactional
    public UserPlaylistDto savePlaylistToLibrary(String userId, String playlistId) {
        User user = usersRepository.getReferenceById(userId);
        UserPlaylist targetPlaylist = userPlaylistsRepository.findByIdOrShareToken(playlistId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Playlist not found"));

        // If user already owns this playlist, it is already in their library
        if (targetPlaylist.getUser().getId().equals(userId)) {
            return UserPlaylistDto.fromEntity(targetPlaylist);
        }

        // Only PUBLIC playlists can be saved to user's library as dynamic playlists
        if (targetPlaylist.getPrivacy() != PlaylistPrivacyEnum.PUBLIC) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only public playlists can be saved to your library");
        }

        if (!userSavedPlaylistsRepository.existsByUserAndPlaylist(user, targetPlaylist)) {
            UserSavedPlaylist saved = UserSavedPlaylist.builder()
                    .id(UUID.randomUUID().toString())
                    .user(user)
                    .playlist(targetPlaylist)
                    .savedAt(LocalDateTime.now())
                    .build();
            userSavedPlaylistsRepository.save(saved);
        }

        return UserPlaylistDto.fromEntity(targetPlaylist);
    }

    @Transactional
    public void unsavePlaylistFromLibrary(String userId, String playlistId) {
        if (userId == null || playlistId == null) return;
        userSavedPlaylistsRepository.deleteByUserIdAndPlaylistTokenOrId(userId, playlistId);
    }

    @Transactional(readOnly = true)
    public boolean isPlaylistSaved(String userId, String playlistId) {
        if (userId == null || playlistId == null) return false;
        return userSavedPlaylistsRepository.isPlaylistSavedByUser(userId, playlistId);
    }

    @Transactional
    public UserPlaylistDto duplicatePlaylist(String userId, String playlistId) {
        User user = usersRepository.getReferenceById(userId);
        UserPlaylist sourcePlaylist = userPlaylistsRepository.findByIdOrShareToken(playlistId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Playlist not found"));

        if (sourcePlaylist.getPrivacy() == PlaylistPrivacyEnum.PRIVATE) {
            if (!sourcePlaylist.getUser().getId().equals(userId)) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Cannot copy a private playlist");
            }
        }

        List<Song> songs = userPlaylistsRepository.findSongsByUserPlaylistIdPaginated(sourcePlaylist.getId(), 0, 1000);

        String newShareToken = UUID.randomUUID().toString().replace("-", "");
        UserPlaylist cloned = UserPlaylist.builder()
                .id(UUID.randomUUID().toString())
                .name(sourcePlaylist.getName() + " (Copy)")
                .privacy(PlaylistPrivacyEnum.PRIVATE)
                .shareToken(newShareToken)
                .user(user)
                .totalSongs(songs.size())
                .songs(new ArrayList<>(songs))
                .build();

        userPlaylistsRepository.save(cloned);
        paginationMetaDataService.incrementStatus("UserPlaylists_" + userId, null);
        paginationMetaDataService.incrementStatus("UserPlaylistSongs_" + cloned.getId(), null);

        return UserPlaylistDto.fromEntity(cloned);
    }

    @Transactional
    public UserPlaylistDto removeSong(String userId, String playlistId, String songId) {
        UserPlaylist playlist = getPlaylistOwnedBy(userId, playlistId);

        boolean removed = userPlaylistsRepository.removeSongFromPlaylist(playlistId, songId);
        if (removed) {
            playlist.setTotalSongs(Math.max(0, playlist.getTotalSongs() - 1));
            paginationMetaDataService.decrementStatus("UserPlaylistSongs_" + playlistId, null);
        }

        // Track in Recombee AFTER_COMMIT
        eventPublisher.publishEvent(new TelemetryEvents.PlaylistSongEvent(userId, songId, false));

        return UserPlaylistDto.fromEntity(playlist);
    }


    private UserPlaylist getPlaylistOwnedBy(String userId, String playlistId) {
        UserPlaylist playlist = userPlaylistsRepository.findById(playlistId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Playlist not found"));
        if (!playlist.getUser().getId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not your playlist");
        }
        return playlist;
    }
}
