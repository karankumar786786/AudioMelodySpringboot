package me.one_org.melody.Redis;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.Map;
import java.util.Set;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
public class RedisTest {

    @Autowired
    private Redis redis;

    @Test
    public void testRedisBasicOperations() {
        String testKey = "test_key_basic";
        String testValue = "Hello Redis from Melody backend!";

        // 1. Basic Set & Get
        redis.set(testKey, testValue);
        assertTrue(redis.hasKey(testKey));
        assertEquals(testValue, redis.get(testKey, String.class));

        // 2. Expiration/TTL
        redis.set(testKey + "_expire", testValue, 5, TimeUnit.SECONDS);
        long ttl = redis.getExpire(testKey + "_expire");
        assertTrue(ttl > 0 && ttl <= 5);

        // 3. Delete
        redis.delete(testKey);
        assertFalse(redis.hasKey(testKey));
        redis.delete(testKey + "_expire");
    }

    @Test
    public void testRedisHashOperations() {
        String hashKey = "test_hash_key";
        
        redis.hSet(hashKey, "field1", "value1");
        redis.hSet(hashKey, "field2", "value2");
        
        assertTrue(redis.hHasKey(hashKey, "field1"));
        assertEquals("value1", redis.hGet(hashKey, "field1"));
        
        Map<Object, Object> allEntries = redis.hGetAll(hashKey);
        assertEquals(2, allEntries.size());
        assertEquals("value2", allEntries.get("field2"));
        
        redis.hDelete(hashKey, "field1");
        assertFalse(redis.hHasKey(hashKey, "field1"));
        
        redis.delete(hashKey);
    }

    @Test
    public void testRedisSetOperations() {
        String setKey = "test_set_key";
        
        redis.sAdd(setKey, "member1", "member2", "member3");
        Set<Object> members = redis.sMembers(setKey);
        
        assertEquals(3, members.size());
        assertTrue(members.contains("member1"));
        assertTrue(members.contains("member2"));
        assertTrue(members.contains("member3"));
        
        redis.sRemove(setKey, "member2");
        Set<Object> membersAfterRemove = redis.sMembers(setKey);
        assertEquals(2, membersAfterRemove.size());
        assertFalse(membersAfterRemove.contains("member2"));
        
        redis.delete(setKey);
    }
}
