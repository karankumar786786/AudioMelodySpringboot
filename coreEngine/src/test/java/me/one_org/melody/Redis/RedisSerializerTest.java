package me.one_org.melody.Redis;

import java.time.LocalDateTime;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.data.redis.serializer.GenericJacksonJsonRedisSerializer;

import me.one_org.melody.Configuration.RedisConfig;
import me.one_org.melody.Dto.Controllers.Api.SongDto;
import me.one_org.melody.Enums.StatusEnum;

import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.cfg.DateTimeFeature;

import static org.junit.jupiter.api.Assertions.*;

class RedisSerializerTest {

    @Test
    void testSerializationAndDeserializationOfSongList() throws Exception {
        RedisConfig config = new RedisConfig();
        // Invoke createJsonRedisSerializer via reflection or by testing RedisTemplate
        var method = RedisConfig.class.getDeclaredMethod("createJsonRedisSerializer");
        method.setAccessible(true);
        GenericJacksonJsonRedisSerializer serializer = (GenericJacksonJsonRedisSerializer) method.invoke(config);

        SongDto song = new SongDto(
                "song-1", "Test Song", "Artist", 180, "key", "img", "vid", "fullVid",
                0, 30, true, "en", "pop", "album", "lrclib", StatusEnum.ACTIVE, 100L, LocalDateTime.now()
        );
        List<SongDto> list = List.of(song);

        byte[] bytes = serializer.serialize(list);
        assertNotNull(bytes);
        System.out.println("SERIALIZED JSON: " + new String(bytes, java.nio.charset.StandardCharsets.UTF_8));

        GenericJacksonJsonRedisSerializer cleanSerializer = GenericJacksonJsonRedisSerializer.builder()
                .enableSpringCacheNullValueSupport()
                .customize(builder -> builder
                        .disable(DateTimeFeature.WRITE_DATES_AS_TIMESTAMPS)
                        .disable(DeserializationFeature.FAIL_ON_NULL_FOR_PRIMITIVES)
                        .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES))
                .build();

        // 1. Test single object
        byte[] songBytes = cleanSerializer.serialize(song);
        Object desSong = cleanSerializer.deserialize(songBytes);
        assertNotNull(desSong);

        // 2. Test list
        byte[] listBytes = cleanSerializer.serialize(list);
        Object desList = cleanSerializer.deserialize(listBytes);
        assertNotNull(desList);
        assertTrue(desList instanceof List);
        assertEquals(1, ((List<?>) desList).size());
    }
}
