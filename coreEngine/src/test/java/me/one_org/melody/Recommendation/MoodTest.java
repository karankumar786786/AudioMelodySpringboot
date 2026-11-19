package me.one_org.melody.Recommendation;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class MoodTest {

    @Test
    @DisplayName("parse is case-insensitive and trims")
    void shouldParseCaseInsensitively() {
        assertThat(Mood.parse("chill")).isEqualTo(Mood.CHILL);
        assertThat(Mood.parse(" Workout ")).isEqualTo(Mood.WORKOUT);
        assertThat(Mood.parse("FOCUS")).isEqualTo(Mood.FOCUS);
        assertThat(Mood.parse("happy")).isEqualTo(Mood.HAPPY);
        assertThat(Mood.parse("sad")).isEqualTo(Mood.SAD);
    }

    @Test
    @DisplayName("parse rejects unknown or missing moods with the list of valid ones")
    void shouldRejectUnknownMood() {
        assertThatThrownBy(() -> Mood.parse("angry"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("chill, workout, focus, happy, sad");
        assertThatThrownBy(() -> Mood.parse(null)).isInstanceOf(IllegalArgumentException.class);
    }

    @ParameterizedTest
    @EnumSource(Mood.class)
    @DisplayName("each mood's target profile lies inside its own candidate ranges")
    void targetShouldFallInsideRanges(Mood mood) {
        AudioProfile t = mood.target();
        assertThat(t.tempo()).isNotNull();
        assertThat(t.energy()).isBetween(0.0, 1.0);
        assertThat(t.valence()).isBetween(0.0, 1.0);
        assertThat(t.danceability()).isBetween(0.0, 1.0);
        assertThat(mood.matches(t)).isTrue();
    }

    @Test
    @DisplayName("moods separate high-energy from low-energy and happy from sad sounds")
    void shouldSeparateContrastingSounds() {
        AudioProfile banger = new AudioProfile(128.0, 0.9, 0.75, 0.8);
        AudioProfile ballad = new AudioProfile(72.0, 0.2, 0.15, 0.3);

        assertThat(Mood.WORKOUT.matches(banger)).isTrue();
        assertThat(Mood.HAPPY.matches(banger)).isTrue();
        assertThat(Mood.CHILL.matches(banger)).isFalse();
        assertThat(Mood.SAD.matches(banger)).isFalse();

        assertThat(Mood.SAD.matches(ballad)).isTrue();
        assertThat(Mood.WORKOUT.matches(ballad)).isFalse();
        assertThat(Mood.HAPPY.matches(ballad)).isFalse();
    }

    @Test
    @DisplayName("unknown tempo still matches on energy and valence; missing energy never matches")
    void shouldTolerateUnknownTempoOnly() {
        assertThat(Mood.CHILL.matches(new AudioProfile(null, 0.3, 0.5, null))).isTrue();
        assertThat(Mood.CHILL.matches(new AudioProfile(90.0, null, 0.5, 0.4))).isFalse();
    }
}
