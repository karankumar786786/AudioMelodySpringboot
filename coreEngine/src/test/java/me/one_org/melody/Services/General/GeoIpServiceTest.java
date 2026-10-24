package me.one_org.melody.Services.General;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import com.fasterxml.jackson.databind.ObjectMapper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class GeoIpServiceTest {

    @Mock
    private StringRedisTemplate redisTemplate;

    @Mock
    private ValueOperations<String, String> valueOperations;

    @Test
    @DisplayName("Should prioritize proxy geolocation headers when provided")
    void shouldPrioritizeProxyHeaders() {
        GeoIpService service = new GeoIpService(redisTemplate, new ObjectMapper());

        String location = service.resolveLocation("203.0.113.1", "Mumbai", "India");

        assertThat(location).isEqualTo("Mumbai, India");
        verifyNoInteractions(redisTemplate);
    }

    @Test
    @DisplayName("Should detect local and private loopback IPs as Local Network")
    void shouldDetectLocalIps() {
        GeoIpService service = new GeoIpService(redisTemplate, new ObjectMapper());

        assertThat(service.resolveLocation("127.0.0.1", null, null)).isEqualTo("Local Network");
        assertThat(service.resolveLocation("::1", null, null)).isEqualTo("Local Network");
        assertThat(service.resolveLocation("192.168.1.50", null, null)).isEqualTo("Local Network");
        assertThat(service.resolveLocation("10.0.1.20", null, null)).isEqualTo("Local Network");
        assertThat(service.resolveLocation("172.20.0.4", null, null)).isEqualTo("Local Network");
        verifyNoInteractions(redisTemplate);
    }

    @Test
    @DisplayName("Should return Unknown Location on null or blank IP")
    void shouldReturnUnknownOnBlankIp() {
        GeoIpService service = new GeoIpService(redisTemplate, new ObjectMapper());

        assertThat(service.resolveLocation(null, null, null)).isEqualTo("Unknown Location");
        assertThat(service.resolveLocation("   ", null, null)).isEqualTo("Unknown Location");
    }

    @Test
    @DisplayName("Should return cached location from Redis when available")
    void shouldReturnCachedLocation() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get("geoip:cache:8.8.8.8")).thenReturn("Mountain View, United States");

        GeoIpService service = new GeoIpService(redisTemplate, new ObjectMapper());
        String location = service.resolveLocation("8.8.8.8", null, null);

        assertThat(location).isEqualTo("Mountain View, United States");
        verify(valueOperations).get("geoip:cache:8.8.8.8");
    }
}
