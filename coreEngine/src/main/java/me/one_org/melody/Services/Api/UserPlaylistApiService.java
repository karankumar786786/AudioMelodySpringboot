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
import me.one_org.melody.Entity.PaginationMetaData;
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
    public List<UserPlaylist> getUserPlaylists(String userId) {
        User user = usersRepository.getReferenceById(userId);
        List<UserPlaylist> owned = userPlaylistsRepository.findByUser(user);
        List<UserPlaylist> saved = userSavedPlaylistsRepository.findSavedPlaylistsByUserId(userId);

        List<UserPlaylist> combined = new ArrayList<>(owned);
        for (UserPlaylist sp : saved) {
            if (combined.stream().noneMatch(p -> p.getId().equals(sp.getId()))) {
                combined.add(sp);
            }
        }
        return combined;
    }

    @Transactional(readOnly = true)
    public List<UserPlaylist> getUserPlaylistsPaginated(String userId, int page, int size) {
        if (userId == null || userId.isBlank() || size <= 0 || page < 0) {
            return List.of();
        }

        // Early guard against out-of-bounds page requests via cached Redis metadata
        PaginationMetaData meta = paginationMetaDataService.getMetaData("UserPlaylists_" + userId);
        if (meta == null || meta.getTotalCount() == 0 || (long) page * size >= meta.getTotalCount()) {
            return List.of();
        }

        User user = usersRepository.getReferenceById(userId);
        return userPlaylistsRepository.findByUserPaginated(user, page, size);
    }

    public PaginationMetaData getPaginationMetaData(String userId) {
        return paginationMetaDataService.getMetaData("UserPlaylists_" + userId);
    }

    @Transactional
    public UserPlaylist createPlaylist(String userId, String name, PlaylistPrivacyEnum privacy) {
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

        return playlist;
    }

    @Transactional
    public UserPlaylist renamePlaylist(String userId, String playlistId, String name) {
        UserPlaylist playlist = getPlaylistOwnedBy(userId, playlistId);
        playlist.setName(name);
        userPlaylistsRepository.save(playlist);

        // If public, sync to Algolia AFTER_COMMIT
        if (playlist.getPrivacy() == PlaylistPrivacyEnum.PUBLIC) {
            eventPublisher.publishEvent(new AlgoliaEvents.PlaylistIndexSyncEvent(playlist.getId(), playlist.getName()));
        }

        return playlist;
    }

    @Transactional
    public UserPlaylist updatePlaylistPrivacy(String userId, String playlistId, PlaylistPrivacyEnum privacy) {
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

        return playlist;
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
    public UserPlaylist addSong(String userId, String playlistId, String songId) {
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

        return playlist;
    }

    @Transactional(readOnly = true)
    public UserPlaylist getPlaylistById(String userId, String playlistId) {
        UserPlaylist playlist = userPlaylistsRepository.findById(playlistId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Playlist not found"));
        if (playlist.getPrivacy() != PlaylistPrivacyEnum.PUBLIC) {
            if (userId == null || !playlist.getUser().getId().equals(userId)) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not your playlist");
            }
        }
        return playlist;
    }

    @Transactional(readOnly = true)
    public List<Song> getPlaylistSongsPaginated(String userId, String playlistId, int page, int size) {
        if (playlistId == null || playlistId.isBlank() || size <= 0 || page < 0) {
            return List.of();
        }
        getPlaylistById(userId, playlistId);

        // Early guard against out-of-bounds page requests via cached Redis metadata
        PaginationMetaData meta = paginationMetaDataService.getMetaData("UserPlaylistSongs_" + playlistId);
        if (meta == null || meta.getTotalCount() == 0 || (long) page * size >= meta.getTotalCount()) {
            return List.of();
        }

        return userPlaylistsRepository.findSongsByUserPlaylistIdPaginated(playlistId, page, size);
    }

    public PaginationMetaData getPlaylistSongsPaginationMetaData(String playlistId) {
        return paginationMetaDataService.getMetaData("UserPlaylistSongs_" + playlistId);
    }

    @Transactional(readOnly = true)
    public UserPlaylist getSharedPlaylist(String tokenOrId, String callerUserId) {
        UserPlaylist playlist = userPlaylistsRepository.findByIdOrShareToken(tokenOrId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Playlist not found"));

        if (playlist.getPrivacy() == PlaylistPrivacyEnum.PRIVATE) {
            if (callerUserId == null || !playlist.getUser().getId().equals(callerUserId)) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "This playlist is private");
            }
        }
        return playlist;
    }

    @Transactional(readOnly = true)
    public List<Song> getSharedPlaylistSongsPaginated(String tokenOrId, String callerUserId, int page, int size) {
        if (tokenOrId == null || tokenOrId.isBlank() || size <= 0 || page < 0) {
            return List.of();
        }
        UserPlaylist playlist = getSharedPlaylist(tokenOrId, callerUserId);

        // Early guard against out-of-bounds page requests via cached Redis metadata
        PaginationMetaData meta = paginationMetaDataService.getMetaData("UserPlaylistSongs_" + playlist.getId());
        if (meta == null || meta.getTotalCount() == 0 || (long) page * size >= meta.getTotalCount()) {
            return List.of();
        }

        return userPlaylistsRepository.findSongsByUserPlaylistIdPaginated(playlist.getId(), page, size);
    }

    @Transactional
    public UserPlaylist savePlaylistToLibrary(String userId, String playlistId) {
        User user = usersRepository.getReferenceById(userId);
        UserPlaylist targetPlaylist = userPlaylistsRepository.findByIdOrShareToken(playlistId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Playlist not found"));

        // If user already owns this playlist, it is already in their library
        if (targetPlaylist.getUser().getId().equals(userId)) {
            return targetPlaylist;
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

        return targetPlaylist;
    }

    @Transactional
    public void unsavePlaylistFromLibrary(String userId, String playlistId) {
        User user = usersRepository.getReferenceById(userId);
        UserPlaylist targetPlaylist = userPlaylistsRepository.findByIdOrShareToken(playlistId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Playlist not found"));

        userSavedPlaylistsRepository.deleteByUserAndPlaylist(user, targetPlaylist);
    }

    @Transactional(readOnly = true)
    public boolean isPlaylistSaved(String userId, String playlistId) {
        if (userId == null) return false;
        User user = usersRepository.getReferenceById(userId);
        UserPlaylist targetPlaylist = userPlaylistsRepository.findByIdOrShareToken(playlistId).orElse(null);
        if (targetPlaylist == null) return false;
        if (targetPlaylist.getUser().getId().equals(userId)) return true;
        return userSavedPlaylistsRepository.existsByUserAndPlaylist(user, targetPlaylist);
    }

    @Transactional
    public UserPlaylist duplicatePlaylist(String userId, String playlistId) {
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

        return cloned;
    }

    @Transactional
    public UserPlaylist removeSong(String userId, String playlistId, String songId) {
        UserPlaylist playlist = getPlaylistOwnedBy(userId, playlistId);

        boolean removed = userPlaylistsRepository.removeSongFromPlaylist(playlistId, songId);
        if (removed) {
            playlist.setTotalSongs(Math.max(0, playlist.getTotalSongs() - 1));
            paginationMetaDataService.decrementStatus("UserPlaylistSongs_" + playlistId, null);
        }

        // Track in Recombee AFTER_COMMIT
        eventPublisher.publishEvent(new TelemetryEvents.PlaylistSongEvent(userId, songId, false));

        return playlist;
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
