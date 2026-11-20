package me.one_org.melody.Recommendation;

import java.util.Map;

import me.one_org.melody.Dto.Controllers.Api.SongDto;
import me.one_org.melody.Entity.Song;

/**
 * Audio features of a song (tempo in BPM; energy, valence and danceability in 0..1).
 * Any field may be null when the feature is unknown.
 */
public record AudioProfile(Double tempo, Double energy, Double valence, Double danceability) {

    /** Recombee property names holding audio features. */
    public static final String[] PROPERTY_NAMES = {"tempo", "energy", "valence", "danceability"};

    public boolean hasAny() {
        return tempo != null || energy != null || valence != null || danceability != null;
    }

    public static AudioProfile of(SongDto dto) {
        if (dto == null) return null;
        AudioProfile p = new AudioProfile(dto.tempo(), dto.energy(), dto.valence(), dto.danceability());
        return p.hasAny() ? p : null;
    }

    /** Profile stored on the song row (Flyway V15); null when the song has no features. */
    public static AudioProfile of(Song song) {
        if (song == null) return null;
        AudioProfile p = new AudioProfile(song.getTempo(), song.getEnergy(), song.getValence(), song.getDanceability());
        return p.hasAny() ? p : null;
    }

    /** Builds a profile from Recombee item values; returns null when no audio feature is present. */
    public static AudioProfile fromValues(Map<String, Object> values) {
        if (values == null) return null;
        AudioProfile p = new AudioProfile(
                number(values.get("tempo")),
                number(values.get("energy")),
                number(values.get("valence")),
                number(values.get("danceability")));
        return p.hasAny() ? p : null;
    }

    private static Double number(Object o) {
        return o instanceof Number n ? n.doubleValue() : null;
    }
}
