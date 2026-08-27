package me.one_org.melody.Dto.Queue;

import me.one_org.melody.Entity.ArtistsEntity;
import me.one_org.melody.Entity.PlaylistsEntity;
import me.one_org.melody.Entity.SongsEntity;
import me.one_org.melody.Enums.DeleteEntityType;

public record DeleteEventQueueDto(
        DeleteEntityType entityType,
        String entityId,
        String songKey,
        String imageKey,
        String coverImageKey,
        String videoKey
) {
    public static DeleteEventQueueDto forSong(SongsEntity song) {
        return new DeleteEventQueueDto(
                DeleteEntityType.SONG,
                song.getId(),
                song.getSongKey(),
                song.getImageKey(),
                null,
                song.getVideoKey()
        );
    }

    public static DeleteEventQueueDto forPlaylist(PlaylistsEntity playlist) {
        return new DeleteEventQueueDto(
                DeleteEntityType.PLAYLIST,
                playlist.getId(),
                null,
                null,
                playlist.getCoverImageKey(),
                playlist.getVideoKey()
        );
    }

    public static DeleteEventQueueDto forArtist(ArtistsEntity artist) {
        return new DeleteEventQueueDto(
                DeleteEntityType.ARTIST,
                artist.getId(),
                null,
                null,
                artist.getCoverImageKey(),
                null
        );
    }
}