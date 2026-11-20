package me.oneorg.melody.events;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.apache.avro.Schema;
import org.apache.avro.generic.GenericData;
import org.apache.avro.generic.GenericDatumWriter;
import org.apache.avro.generic.GenericRecord;
import org.apache.avro.io.BinaryEncoder;
import org.apache.avro.io.DecoderFactory;
import org.apache.avro.io.EncoderFactory;
import org.apache.avro.specific.SpecificDatumReader;
import org.apache.avro.specific.SpecificRecord;

/**
 * Converts an outbox row's plain-JSON payload (snake_case Avro field names, no union
 * wrappers, already parsed into Maps/Lists) into the topic's generated Avro class.
 * The "meta" field is filled from the outbox row, so writers never build EventMeta.
 * Missing fields take the schema default; unknown fields are ignored.
 */
public final class OutboxPayloads {

    private static final Map<String, Class<? extends SpecificRecord>> TOPIC_TYPES = Map.of(
            Topics.FAVOURITE, FavouriteChanged.class,
            Topics.PLAYLIST_SONG, PlaylistSongChanged.class,
            Topics.ARTIST_FOLLOW, ArtistFollowChanged.class,
            Topics.USER_LIFECYCLE, UserLifecycleEvent.class,
            Topics.CATALOG_SONG, SongChanged.class,
            Topics.EMAIL, EmailRequested.class);

    private OutboxPayloads() {}

    public static boolean supports(String topic) {
        return TOPIC_TYPES.containsKey(topic);
    }

    public static SpecificRecord toAvro(String topic, Map<String, Object> payload, EventMeta meta) {
        Class<? extends SpecificRecord> type = TOPIC_TYPES.get(topic);
        if (type == null) throw new IllegalArgumentException("No Avro type for outbox topic " + topic);
        Schema schema = schemaOf(type);
        GenericRecord generic = record(schema, payload, meta);
        return toSpecific(generic, schema, type);
    }

    private static Schema schemaOf(Class<? extends SpecificRecord> type) {
        try {
            return (Schema) type.getField("SCHEMA$").get(null);
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(e);
        }
    }

    private static GenericRecord record(Schema schema, Map<String, Object> values, EventMeta meta) {
        GenericData.Record record = new GenericData.Record(schema);
        for (Schema.Field field : schema.getFields()) {
            if ("meta".equals(field.name()) && meta != null) {
                record.put(field.pos(), metaRecord(field.schema(), meta));
                continue;
            }
            Object raw = values == null ? null : values.get(field.name());
            if (raw == null && (values == null || !values.containsKey(field.name()))) {
                if (field.hasDefaultValue()) {
                    record.put(field.pos(), GenericData.get().getDefaultValue(field));
                    continue;
                }
                throw new IllegalArgumentException("Missing required field '" + field.name() + "' for " + schema.getName());
            }
            record.put(field.pos(), value(field.schema(), raw, field.name()));
        }
        return record;
    }

    private static GenericRecord metaRecord(Schema schema, EventMeta meta) {
        GenericData.Record r = new GenericData.Record(schema);
        r.put("event_id", meta.getEventId());
        r.put("occurred_at", meta.getOccurredAt().toEpochMilli());
        r.put("received_at", meta.getReceivedAt().toEpochMilli());
        r.put("source", meta.getSource());
        return r;
    }

    @SuppressWarnings("unchecked")
    private static Object value(Schema schema, Object raw, String name) {
        switch (schema.getType()) {
            case UNION:
                if (raw == null) {
                    if (schema.getTypes().stream().anyMatch(s -> s.getType() == Schema.Type.NULL)) return null;
                    throw new IllegalArgumentException("Field '" + name + "' can't be null");
                }
                for (Schema branch : schema.getTypes()) {
                    if (branch.getType() != Schema.Type.NULL) return value(branch, raw, name);
                }
                return null;
            case NULL:
                return null;
            case STRING:
                return raw.toString();
            case BOOLEAN:
                if (raw instanceof Boolean b) return b;
                return Boolean.parseBoolean(raw.toString());
            case INT:
                if ("date".equals(logical(schema)) && raw instanceof String s) return (int) java.time.LocalDate.parse(s).toEpochDay();
                return ((Number) number(raw)).intValue();
            case LONG:
                if ("timestamp-millis".equals(logical(schema)) && raw instanceof String s) return Instant.parse(s).toEpochMilli();
                return ((Number) number(raw)).longValue();
            case DOUBLE:
                return ((Number) number(raw)).doubleValue();
            case FLOAT:
                return ((Number) number(raw)).floatValue();
            case ENUM: {
                String symbol = raw.toString().trim().toUpperCase();
                if (!schema.getEnumSymbols().contains(symbol)) {
                    throw new IllegalArgumentException("Field '" + name + "': '" + raw + "' is not one of " + schema.getEnumSymbols());
                }
                return new GenericData.EnumSymbol(schema, symbol);
            }
            case ARRAY: {
                List<Object> out = new ArrayList<>();
                for (Object item : (List<Object>) raw) out.add(value(schema.getElementType(), item, name));
                return new GenericData.Array<>(schema, out);
            }
            case RECORD:
                return record(schema, (Map<String, Object>) raw, null);
            default:
                throw new IllegalArgumentException("Unsupported Avro type " + schema.getType() + " for '" + name + "'");
        }
    }

    private static String logical(Schema schema) {
        return schema.getLogicalType() == null ? null : schema.getLogicalType().getName();
    }

    private static Object number(Object raw) {
        if (raw instanceof Number) return raw;
        return Double.valueOf(raw.toString());
    }

    /** Round-trips through Avro binary so logical types become Instant/LocalDate on the generated class. */
    private static <T extends SpecificRecord> T toSpecific(GenericRecord generic, Schema schema, Class<T> type) {
        try {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            BinaryEncoder encoder = EncoderFactory.get().binaryEncoder(out, null);
            new GenericDatumWriter<GenericRecord>(schema).write(generic, encoder);
            encoder.flush();
            SpecificDatumReader<T> reader = new SpecificDatumReader<>(type);
            return reader.read(null, DecoderFactory.get().binaryDecoder(out.toByteArray(), null));
        } catch (IOException e) {
            throw new IllegalStateException("Avro conversion failed for " + schema.getName(), e);
        }
    }
}
