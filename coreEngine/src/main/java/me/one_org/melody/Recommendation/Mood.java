package me.one_org.melody.Recommendation;

import java.util.Arrays;
import java.util.Locale;
import java.util.stream.Collectors;

/**
 * Moods offered by mood radio. Each mood has:
 * <ul>
 *   <li>a <b>target</b> {@link AudioProfile} — the "ideal" sound, used as the seed audio when ranking;</li>
 *   <li><b>candidate ranges</b> — the window of energy, valence and tempo pulled from the database.
 *       Ranges are deliberately wider than the target so ranking (not the filter) decides order.</li>
 * </ul>
 * Scales follow the audio pipeline ({@code audioProcessing/lib/transcode/audioFeatures.ts}):
 * tempo in BPM, energy/valence/danceability in 0..1 (valence is clamped to 0.10–0.95 there).
 * Songs whose tempo is unknown still qualify on energy/valence, since beat tracking can fail.
 */
public enum Mood {
    //            target: tempo, energy, valence, dance   energy range   valence range   tempo range
    CHILL(  new AudioProfile( 90.0, 0.30, 0.55, 0.45),   0.00, 0.50,     0.25, 0.85,     60, 115),
    WORKOUT(new AudioProfile(130.0, 0.85, 0.65, 0.75),   0.65, 1.00,     0.30, 1.00,    110, 185),
    FOCUS(  new AudioProfile(100.0, 0.35, 0.40, 0.35),   0.10, 0.55,     0.15, 0.65,     65, 125),
    HAPPY(  new AudioProfile(120.0, 0.70, 0.85, 0.70),   0.40, 1.00,     0.60, 1.00,     90, 160),
    SAD(    new AudioProfile( 80.0, 0.25, 0.15, 0.30),   0.00, 0.50,     0.00, 0.35,     50, 115);

    private final AudioProfile target;
    private final double minEnergy;
    private final double maxEnergy;
    private final double minValence;
    private final double maxValence;
    private final double minTempo;
    private final double maxTempo;

    Mood(AudioProfile target, double minEnergy, double maxEnergy,
         double minValence, double maxValence, double minTempo, double maxTempo) {
        this.target = target;
        this.minEnergy = minEnergy;
        this.maxEnergy = maxEnergy;
        this.minValence = minValence;
        this.maxValence = maxValence;
        this.minTempo = minTempo;
        this.maxTempo = maxTempo;
    }

    public AudioProfile target() { return target; }
    public double minEnergy() { return minEnergy; }
    public double maxEnergy() { return maxEnergy; }
    public double minValence() { return minValence; }
    public double maxValence() { return maxValence; }
    public double minTempo() { return minTempo; }
    public double maxTempo() { return maxTempo; }

    /** True when the profile falls inside this mood's candidate ranges (null tempo allowed). */
    public boolean matches(AudioProfile p) {
        if (p == null || p.energy() == null || p.valence() == null) return false;
        boolean tempoOk = p.tempo() == null || (p.tempo() >= minTempo && p.tempo() <= maxTempo);
        return p.energy() >= minEnergy && p.energy() <= maxEnergy
                && p.valence() >= minValence && p.valence() <= maxValence
                && tempoOk;
    }

    /** Case-insensitive lookup; throws {@link IllegalArgumentException} (HTTP 400) for unknown moods. */
    public static Mood parse(String value) {
        if (value != null) {
            String key = value.trim().toUpperCase(Locale.ROOT);
            for (Mood m : values()) {
                if (m.name().equals(key)) return m;
            }
        }
        throw new IllegalArgumentException("Unknown mood '" + value + "'. Expected one of: "
                + Arrays.stream(values()).map(m -> m.name().toLowerCase(Locale.ROOT)).collect(Collectors.joining(", ")));
    }
}
