package me.one_org.melody.Services.Api;

import java.util.HashSet;
import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import me.one_org.melody.Entity.PaginationMetaDataEntity;
import me.one_org.melody.Entity.SongsEntity;
import me.one_org.melody.Entity.UserPlaylistsEntity;
import me.one_org.melody.Entity.UsersEntity;
import me.one_org.melody.Recommendation.Recombee;
import me.one_org.melody.Repository.SongsRepository;
import me.one_org.melody.Repository.UserPlaylistsRepository;
import me.one_org.melody.Repository.UsersRepository;
import me.one_org.melody.Services.General.PaginationMetaDataService;

@Service
public class UserPlaylistApiService {

    private final UserPlaylistsRepository userPlaylistsRepository;
    private final SongsRepository songsRepository;
    private final UsersRepository usersRepository;
    private final Recombee recombee;
    private final PaginationMetaDataService paginationMetaDataService;

    public UserPlaylistApiService(UserPlaylistsRepository userPlaylistsRepository,
            SongsRepository songsRepository, UsersRepository usersRepository,
            Recombee recombee, PaginationMetaDataService paginationMetaDataService) {
        this.userPlaylistsRepository = userPlaylistsRepository;
        this.songsRepository = songsRepository;
        this.usersRepository = usersRepository;
        this.recombee = recombee;
        this.paginationMetaDataService = paginationMetaDataService;
    }

    public List<UserPlaylistsEntity> getUserPlaylists(String userId) {
        UsersEntity user = getUser(userId);
        return userPlaylistsRepository.findByUser(user);
    }

    public List<UserPlaylistsEntity> getUserPlaylistsPaginated(String userId, int page, int size) {
        UsersEntity user = getUser(userId);
        return userPlaylistsRepository.findByUserPaginated(user, page, size);
    }

    public PaginationMetaDataEntity getPaginationMetaData(String userId) {
        return paginationMetaDataService.getMetaData("UserPlaylists_" + userId);
    }

    @Transactional
    public UserPlaylistsEntity createPlaylist(String userId, String name) {
        UsersEntity user = getUser(userId);
        UserPlaylistsEntity playlist = UserPlaylistsEntity.builder()
                .id(UUID.randomUUID().toString())
                .name(name)
                .user(user)
                .songs(new HashSet<>())
                .build();
        userPlaylistsRepository.save(playlist);
        paginationMetaDataService.incrementStatus("UserPlaylists_" + userId, playlist.getStatus());
        return playlist;
    }

    @Transactional
    public UserPlaylistsEntity renamePlaylist(String userId, String playlistId, String name) {
        UserPlaylistsEntity playlist = getPlaylistOwnedBy(userId, playlistId);
        playlist.setName(name);
        userPlaylistsRepository.save(playlist);
        return playlist;
    }

    @Transactional
    public void deletePlaylist(String userId, String playlistId) {
        UserPlaylistsEntity playlist = getPlaylistOwnedBy(userId, playlistId);
        userPlaylistsRepository.deleteById(playlistId);
        paginationMetaDataService.decrementStatus("UserPlaylists_" + userId, playlist.getStatus());
    }

    @Transactional
    public UserPlaylistsEntity addSong(String userId, String playlistId, String songId) {
        UserPlaylistsEntity playlist = getPlaylistOwnedBy(userId, playlistId);
        SongsEntity song = songsRepository.findById(songId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Song not found"));

        playlist.getSongs().add(song);
        userPlaylistsRepository.save(playlist);

        // Track in Recombee
        try {
            recombee.trackPlaylistAdd(userId, songId);
        } catch (Exception e) {
            // Log but don't fail
        }
        return playlist;
    }

    @Transactional(readOnly = true)
    public UserPlaylistsEntity getPlaylistById(String userId, String playlistId) {
        return getPlaylistOwnedBy(userId, playlistId);
    }

    @Transactional(readOnly = true)
    public List<SongsEntity> getPlaylistSongsPaginated(String userId, String playlistId, int page, int size) {
        getPlaylistOwnedBy(userId, playlistId);
        return userPlaylistsRepository.findSongsByUserPlaylistIdPaginated(playlistId, page, size);
    }

    public PaginationMetaDataEntity getPlaylistSongsPaginationMetaData(String playlistId) {
        return paginationMetaDataService.getMetaData("UserPlaylistSongs_" + playlistId);
    }

    @Transactional
    public UserPlaylistsEntity removeSong(String userId, String playlistId, String songId) {
        UserPlaylistsEntity playlist = getPlaylistOwnedBy(userId, playlistId);
        playlist.getSongs().removeIf(s -> s.getId().equals(songId));
        userPlaylistsRepository.save(playlist);

        // Track in Recombee
        try {
            recombee.trackPlaylistRemove(userId, songId);
        } catch (Exception e) {
            // Log but don't fail
        }
        return playlist;
    }

    private UsersEntity getUser(String userId) {
        return usersRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
    }

    private UserPlaylistsEntity getPlaylistOwnedBy(String userId, String playlistId) {
        UserPlaylistsEntity playlist = userPlaylistsRepository.findById(playlistId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Playlist not found"));
        if (!playlist.getUser().getId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not your playlist");
        }
        return playlist;
    }
}
