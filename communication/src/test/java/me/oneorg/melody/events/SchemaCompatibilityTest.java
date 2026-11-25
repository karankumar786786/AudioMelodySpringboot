package me.oneorg.melody.events;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.fail;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.stream.Stream;

import org.apache.avro.Schema;
import org.apache.avro.SchemaCompatibility;
import org.apache.avro.specific.SpecificRecord;
import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.TestFactory;

import me.oneorg.melody.events.stats.ArtistStats;
import me.oneorg.melody.events.stats.ListeningSession;
import me.oneorg.melody.events.stats.SongDailyStats;
import me.oneorg.melody.events.stats.SongStatDelta;
import me.oneorg.melody.events.stats.SongStats;

/**
 * Schema Registry runs with BACKWARD compatibility. This test enforces the same rule
 * before merge, offline: every schema must be able to read data written with the last
 * released version (src/test/resources/schema-snapshots). After a compatible change,
 * refresh the snapshots with
 *   ./mvnw -pl communication test -Dschemas.update=true
 * and commit them with the change.
 */
class SchemaCompatibilityTest {

    static final List<Class<? extends SpecificRecord>> SCHEMAS = List.of(
            PlayEvent.class, SkipEvent.class, SearchInteraction.class, QueueChange.class, SongFeedback.class,
            FavouriteChanged.class, PlaylistSongChanged.class, ArtistFollowChanged.class, UserLifecycleEvent.class,
            SongChanged.class, EmailRequested.class, SongStatDelta.class, SongStats.class, SongDailyStats.class,
            ArtistStats.class, ListeningSession.class,
            me.oneorg.melody.events.analytics.SongSecondStats.class,
            me.oneorg.melody.events.analytics.SongTimeline.class,
            me.oneorg.melody.events.analytics.SongDayStats.class,
            me.oneorg.melody.events.analytics.SongQualityStats.class);

    static final Path SNAPSHOTS = Path.of("src/test/resources/schema-snapshots");

    static Schema schemaOf(Class<? extends SpecificRecord> type) {
        try {
            return (Schema) type.getField("SCHEMA$").get(null);
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(e);
        }
    }

    @TestFactory
    Stream<DynamicTest> everySchemaCanReadItsLastReleasedVersion() {
        boolean update = Boolean.getBoolean("schemas.update");
        return SCHEMAS.stream().map(type -> DynamicTest.dynamicTest(type.getSimpleName(), () -> {
            Schema current = schemaOf(type);
            Path snapshot = SNAPSHOTS.resolve(current.getFullName() + ".avsc");
            if (update) {
                Files.createDirectories(SNAPSHOTS);
                Files.writeString(snapshot, current.toString(true) + "\n", StandardCharsets.UTF_8);
                return;
            }
            if (!Files.exists(snapshot)) {
                fail("No snapshot for " + current.getFullName() + ". Run: ./mvnw -pl communication test -Dschemas.update=true");
            }
            Schema released = new Schema.Parser().parse(read(snapshot));
            SchemaCompatibility.SchemaPairCompatibility result =
                    SchemaCompatibility.checkReaderWriterCompatibility(current, released);
            assertEquals(SchemaCompatibility.SchemaCompatibilityType.COMPATIBLE, result.getType(),
                    () -> current.getFullName() + " can't read data written with the released schema: "
                            + result.getResult().getIncompatibilities().stream()
                                    .map(i -> i.getType() + " '" + i.getMessage() + "' at " + i.getLocation()).toList()
                            + ". Add fields only with defaults, never remove or rename one; "
                            + "for a breaking change create a new topic version (.v2).");
        }));
    }

    private static String read(Path p) {
        try {
            return Files.readString(p, StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }
}
