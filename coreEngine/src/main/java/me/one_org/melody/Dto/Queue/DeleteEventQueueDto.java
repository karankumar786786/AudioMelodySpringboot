package me.one_org.melody.Dto.Queue;

import me.one_org.melody.Entity.ArtistsEntity;
import me.one_org.melody.Entity.PlaylistsEntity;
import me.one_org.melody.Entity.SongsEntity;
import me.one_org.melody.Enums.DeleteEntityType;

public record DeleteEventQueueDto(
        String deleteJobId,
        DeleteEntityType entityType,
        String entityId,
        String entityTitle,
        String songKey,
        String imageKey,
        String coverImageKey,
        String videoKey,
        String fullVideoKey
) {
    public static DeleteEventQueueDto forSong(SongsEntity song) {
        return new DeleteEventQueueDto(
                null,
                DeleteEntityType.SONG,
                song.getId(),
                song.getTitle(),
                song.getSongKey(),
                song.getImageKey(),
                null,
                song.getVideoKey(),
                song.getFullVideoKey()
        );
    }

    public static DeleteEventQueueDto forPlaylist(PlaylistsEntity playlist) {
        return new DeleteEventQueueDto(
                null,
                DeleteEntityType.PLAYLIST,
                playlist.getId(),
                playlist.getName(),
                null,
                null,
                playlist.getCoverImageKey(),
                playlist.getVideoKey(),
                null
        );
    }

    public static DeleteEventQueueDto forArtist(ArtistsEntity artist) {
        return new DeleteEventQueueDto(
                null,
                DeleteEntityType.ARTIST,
                artist.getId(),
                artist.getName(),
                null,
                null,
                artist.getCoverImageKey(),
                null,
                null
        );
    }

    public DeleteEventQueueDto withDeleteJobId(String deleteJobId) {
        return new DeleteEventQueueDto(
                deleteJobId,
                this.entityType,
                this.entityId,
                this.entityTitle,
                this.songKey,
                this.imageKey,
                this.coverImageKey,
                this.videoKey,
                this.fullVideoKey
        );
    }
}