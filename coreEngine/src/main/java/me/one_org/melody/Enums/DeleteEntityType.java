package me.one_org.melody.Enums;

public enum DeleteEntityType {
    SONG("SongsEntity"),
    PLAYLIST("PlaylistsEntity"),
    ARTIST("ArtistsEntity");

    private final String metadataEntityName;

    DeleteEntityType(String metadataEntityName) {
        this.metadataEntityName = metadataEntityName;
    }

    public String metadataEntityName() {
        return metadataEntityName;
    }
}