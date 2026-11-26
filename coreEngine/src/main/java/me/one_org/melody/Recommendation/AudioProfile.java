package me.one_org.melody.Recommendation;

import java.util.Map;

import me.one_org.melody.Dto.Controllers.Api.SongDto;
import me.one_org.melody.Entity.Song;

/**
 * Gaane ki "awaaz ki pehchaan" (audio features):
 * - tempo: BPM (beats per minute) - gaana kitna tez hai
 * - energy: 0..1 - kitna josh / shor
 * - valence: 0..1 - kitna khush (1) ya udaas (0)
 * - danceability: 0..1 - naachne layak kitna
 * Pata na ho to koi bhi field null ho sakti hai.
 */
public record AudioProfile(Double tempo, Double energy, Double valence, Double danceability) {

    /** Recombee me in naamon se audio features rakhe hain. */
    public static final String[] PROPERTY_NAMES = {"tempo", "energy", "valence", "danceability"};

    /** Kam se kam ek feature pata hai? */
    public boolean hasAny() {
        return tempo != null || energy != null || valence != null || danceability != null;
    }

    /** SongDto se profile; kuch na ho to null. */
    public static AudioProfile of(SongDto dto) {
        if (dto == null) return null;
        AudioProfile p = new AudioProfile(dto.tempo(), dto.energy(), dto.valence(), dto.danceability());
        return p.hasAny() ? p : null;
    }

    /** Song row me rakha profile (Flyway V15); koi feature na ho to null. */
    public static AudioProfile of(Song song) {
        if (song == null) return null;
        AudioProfile p = new AudioProfile(song.getTempo(), song.getEnergy(), song.getValence(), song.getDanceability());
        return p.hasAny() ? p : null;
    }

    /** Recombee ke item values se profile; ek bhi audio feature na ho to null. */
    public static AudioProfile fromValues(Map<String, Object> values) {
        if (values == null) return null;
        AudioProfile p = new AudioProfile(
                number(values.get("tempo")),
                number(values.get("energy")),
                number(values.get("valence")),
                number(values.get("danceability")));
        return p.hasAny() ? p : null;
    }

    /** Object number hai to Double, warna null. */
    private static Double number(Object o) {
        return o instanceof Number n ? n.doubleValue() : null;
    }
}
