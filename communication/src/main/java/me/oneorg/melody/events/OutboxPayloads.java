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
 * Outbox row ke simple JSON payload (Avro wale snake_case field naam, bina union wrappers, Map/List me parse
 * hua) ko us topic ki generated Avro class me badalta hai.
 * "meta" field outbox row se bharti hai, isliye likhne walon ko EventMeta banana nahi padta.
 * Jo field missing hai uski schema wali default value; anjaan fields ignore.
 */
public final class OutboxPayloads {

    /** Kaunse topic ka payload kis Avro class me badalna hai. */
    private static final Map<String, Class<? extends SpecificRecord>> TOPIC_TYPES = Map.of(
            Topics.FAVOURITE, FavouriteChanged.class,
            Topics.PLAYLIST_SONG, PlaylistSongChanged.class,
            Topics.ARTIST_FOLLOW, ArtistFollowChanged.class,
            Topics.USER_LIFECYCLE, UserLifecycleEvent.class,
            Topics.CATALOG_SONG, SongChanged.class,
            Topics.EMAIL, EmailRequested.class);

    private OutboxPayloads() {}

    /** Is topic ke liye converter hai? */
    public static boolean supports(String topic) {
        return TOPIC_TYPES.containsKey(topic);
    }

    /** Payload (Map) + meta -> us topic ka Avro object. Unknown topic = error. */
    public static SpecificRecord toAvro(String topic, Map<String, Object> payload, EventMeta meta) {
        Class<? extends SpecificRecord> type = TOPIC_TYPES.get(topic);
        if (type == null) throw new IllegalArgumentException("No Avro type for outbox topic " + topic);
        Schema schema = schemaOf(type);
        GenericRecord generic = record(schema, payload, meta);
        return toSpecific(generic, schema, type);
    }

    /** Avro class ka schema (uske SCHEMA$ field se). */
    private static Schema schemaOf(Class<? extends SpecificRecord> type) {
        try {
            return (Schema) type.getField("SCHEMA$").get(null);
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(e);
        }
    }

    /** Map se schema ke hisaab se GenericRecord banao (missing field = default). */
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

    /** EventMeta ko schema wale record me badlo. */
    private static GenericRecord metaRecord(Schema schema, EventMeta meta) {
        GenericData.Record r = new GenericData.Record(schema);
        r.put("event_id", meta.getEventId());
        r.put("occurred_at", meta.getOccurredAt().toEpochMilli());
        r.put("received_at", meta.getReceivedAt().toEpochMilli());
        r.put("source", meta.getSource());
        return r;
    }

    /** Ek field ki value schema type ke hisaab se badlo (union, array, enum, timestamp...). */
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

    /** Field ka logical type (jaise timestamp-millis), na ho to null. */
    private static String logical(Schema schema) {
        return schema.getLogicalType() == null ? null : schema.getLogicalType().getName();
    }

    /** JSON number ko sahi Java number me badlo. */
    private static Object number(Object raw) {
        if (raw instanceof Number) return raw;
        return Double.valueOf(raw.toString());
    }

    /** Ek baar Avro binary me likh ke wapas padhte hain, taaki logical types (timestamp, date) generated class me Instant / LocalDate ban jaayein. */
    /** GenericRecord -> generated Avro class (binary me likh ke wapas padh ke). */
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
