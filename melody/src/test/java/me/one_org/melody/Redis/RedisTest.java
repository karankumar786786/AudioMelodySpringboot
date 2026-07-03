package me.one_org.melody.Redis;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import me.one_org.melody.Cache.Redis;

import java.util.Optional;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
public class RedisTest {

    @Autowired
    private Redis<String> redis;

    @BeforeEach
    public void setup() {
        redis.of("test_group", String.class);
    }

    @Test
    public void testRedisBasicOperations() {
        String testKey = "test_key_basic";
        String testValue = "Hello Redis from Melody backend!";

        // 1. Basic Set & Get
        redis.set(testKey, testValue);
        assertTrue(redis.exists(testKey));
        
        Optional<String> result = redis.get(testKey);
        assertTrue(result.isPresent());
        assertEquals(testValue, result.get());

        // 2. Expiration/TTL (Set with duration)
        redis.set(testKey + "_expire", testValue, 5, TimeUnit.SECONDS);
        assertTrue(redis.exists(testKey + "_expire"));

        // 3. Delete
        redis.delete(testKey);
        assertFalse(redis.exists(testKey));
        
        redis.delete(testKey + "_expire");
        assertFalse(redis.exists(testKey + "_expire"));
    }
}
