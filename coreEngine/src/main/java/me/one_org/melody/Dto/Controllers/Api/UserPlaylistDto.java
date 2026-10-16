package me.one_org.melody.Dto.Controllers.Api;

import me.one_org.melody.Entity.UserPlaylist;
import me.one_org.melody.Enums.PlaylistPrivacyEnum;

public record UserPlaylistDto(
    String id,
    String name,
    PlaylistPrivacyEnum privacy,
    String shareToken,
    int totalSongs,
    String userId,
    String ownerId,
    String ownerName
) {
    public static UserPlaylistDto fromEntity(UserPlaylist playlist) {
        if (playlist == null) return null;
        String userId = playlist.getUser() != null ? playlist.getUser().getId() : null;
        String ownerName = playlist.getUser() != null ? playlist.getUser().getUserName() : null;
        return new UserPlaylistDto(
            playlist.getId(),
            playlist.getName(),
            playlist.getPrivacy(),
            playlist.getShareToken(),
            playlist.getTotalSongs(),
            userId,
            userId,
            ownerName
        );
    }
}
