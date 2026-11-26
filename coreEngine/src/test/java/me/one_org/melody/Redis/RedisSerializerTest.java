package me.one_org.melody.Redis;

import java.time.LocalDateTime;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.data.redis.serializer.GenericJacksonJsonRedisSerializer;

import me.one_org.melody.Configuration.RedisConfig;
import me.one_org.melody.Dto.Controllers.Api.SongDto;
import me.one_org.melody.Enums.StatusEnum;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit test: RedisSerializer ko akele check karta hai (asli objects ke saath, bina database ke).
 * Har @Test method ek behaviour check karta hai - method ka naam batata hai kya.
 */
class RedisSerializerTest {

    @Test
    void testSerializationAndDeserializationOfSongList() throws Exception {
        RedisConfig config = new RedisConfig();
        // createJsonRedisSerializer ko RedisTemplate ke through test karte hain
        var method = RedisConfig.class.getDeclaredMethod("createJsonRedisSerializer");
        method.setAccessible(true);
        GenericJacksonJsonRedisSerializer serializer = (GenericJacksonJsonRedisSerializer) method.invoke(config);

        SongDto song = new SongDto(
                "song-1", "Test Song", "Artist", 180, "key", "img", "vid", "fullVid",
                0, 30, true, "en", "pop", "album", "India", "lrclib", StatusEnum.ACTIVE, 100L, LocalDateTime.now()
        );
        List<SongDto> list = java.util.stream.Stream.of(song).toList();

        // 1. Ek object
        byte[] songBytes = serializer.serialize(song);
        Object desSong = serializer.deserialize(songBytes);
        assertNotNull(desSong);
        assertTrue(desSong instanceof SongDto, "Expected SongDto but got: " + desSong.getClass());

        // 2. PaginationMetaData
        me.one_org.melody.Entity.PaginationMetaData meta = me.one_org.melody.Entity.PaginationMetaData.builder()
                .id("1")
                .tableName("SongsEntity")
                .totalCount(100L)
                .build();
        byte[] metaBytes = serializer.serialize(meta);
        Object desMeta = serializer.deserialize(metaBytes);
        assertNotNull(desMeta);
        assertTrue(desMeta instanceof me.one_org.melody.Entity.PaginationMetaData, "Expected PaginationMetaData but got: " + desMeta.getClass());

        // 3. stream.toList() wali list
        byte[] listBytes = serializer.serialize(list);
        Object desList = serializer.deserialize(listBytes);
        assertNotNull(desList);
        assertTrue(desList instanceof List);
        assertEquals(1, ((List<?>) desList).size());
        assertTrue(((List<?>) desList).get(0) instanceof SongDto);

        // 4. List.of() (immutable list)
        List<SongDto> listOf = List.of(song);
        byte[] listOfBytes = serializer.serialize(listOf);
        Object desListOf = serializer.deserialize(listOfBytes);
        assertNotNull(desListOf);
        assertTrue(desListOf instanceof List);
        assertEquals(1, ((List<?>) desListOf).size());
        assertTrue(((List<?>) desListOf).get(0) instanceof SongDto);

        // 5. Set.of() (immutable set)
        java.util.Set<String> setOf = java.util.Set.of("rock", "pop");
        byte[] setBytes = serializer.serialize(setOf);
        Object desSet = serializer.deserialize(setBytes);
        assertNotNull(desSet);
        assertTrue(desSet instanceof java.util.Set);
        assertEquals(2, ((java.util.Set<?>) desSet).size());
    }
}
