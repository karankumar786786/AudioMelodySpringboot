package me.one_org.melody.Recommendation;

import java.util.Arrays;
import java.util.Locale;
import java.util.stream.Collectors;

/**
 * Mood radio ke moods. Har mood ke paas:
 * <ul>
 *   <li>ek <b>target</b> {@link AudioProfile} - us mood ki "perfect" awaaz; ranking me isko seed ki tarah use karte hain;</li>
 *   <li><b>candidate ranges</b> - energy, valence aur tempo ki range jiske gaane database se nikaalte hain.
 *       Range jaan-boojh ke target se chaudi hai, taaki order filter nahi, ranking decide kare.</li>
 * </ul>
 * Scale media pipeline jaisa hi hai ({@code audioProcessing/lib/transcode/audioFeatures.ts}):
 * tempo BPM me, energy/valence/danceability 0..1 me (wahan valence 0.10-0.95 me rakha jaata hai).
 * Jinka tempo pata nahi wo bhi energy/valence se chal jaate hain, kyunki beat pakadna kabhi fail ho jaata hai.
 */
public enum Mood {
    //            target: tempo, energy, valence, dance   energy range   valence range   tempo range
    // (CHILL = shaant, WORKOUT = exercise ke liye tez, FOCUS = padhai, HAPPY = khush, SAD = udaas)
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

    /** Profile is mood ki ranges me aata hai? (tempo null ho to bhi chalega) */
    public boolean matches(AudioProfile p) {
        if (p == null || p.energy() == null || p.valence() == null) return false;
        boolean tempoOk = p.tempo() == null || (p.tempo() >= minTempo && p.tempo() <= maxTempo);
        return p.energy() >= minEnergy && p.energy() <= maxEnergy
                && p.valence() >= minValence && p.valence() <= maxValence
                && tempoOk;
    }

    /** Naam se mood (chhote-bade akshar ignore). Galat naam pe {@link IllegalArgumentException} (HTTP 400). */
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
