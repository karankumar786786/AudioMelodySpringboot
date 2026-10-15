package me.one_org.melody.Dto.Controllers.Api;

import java.time.LocalDateTime;
import me.one_org.melody.Entity.Artist;
import me.one_org.melody.Enums.StatusEnum;

public record ArtistDto(
    String id,
    String name,
    String about,
    LocalDateTime dob,
    String coverImageKey,
    StatusEnum status,
    Long followersCount,
    LocalDateTime createdAt
) {
    public static ArtistDto fromEntity(Artist artist) {
        if (artist == null) return null;
        Long followers = artist.getArtistMetadata() != null ? artist.getArtistMetadata().getFollowersCount() : 0L;
        return new ArtistDto(
            artist.getId(),
            artist.getName(),
            artist.getAbout(),
            artist.getDob(),
            artist.getCoverImageKey(),
            artist.getStatus(),
            followers,
            artist.getCreatedAt()
        );
    }
}
