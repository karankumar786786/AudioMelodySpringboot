package me.one_org.melody.Services.General;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.extern.slf4j.Slf4j;

@Service
@Slf4j
public class GeoIpService {

    private static final String GEOIP_CACHE_PREFIX = "geoip:cache:";
    private static final Duration CACHE_TTL = Duration.ofDays(7);

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    @Autowired
    public GeoIpService(@Autowired(required = false) StringRedisTemplate redisTemplate) {
        this(redisTemplate, new ObjectMapper());
    }

    public GeoIpService(StringRedisTemplate redisTemplate, ObjectMapper objectMapper) {
        this.redisTemplate = redisTemplate;
        this.objectMapper = objectMapper != null ? objectMapper : new ObjectMapper();
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofMillis(1200))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
    }

    public GeoIpService() {
        this(null, new ObjectMapper());
    }

    public String resolveLocation(String ipAddress, String cityHeader, String countryHeader) {
        // 1. Prioritize upstream proxy geolocation headers (e.g. Cloudflare CF-IPCity, CF-IPCountry)
        if (cityHeader != null && !cityHeader.isBlank() && countryHeader != null && !countryHeader.isBlank()) {
            return cityHeader.trim() + ", " + countryHeader.trim();
        }
        if (countryHeader != null && !countryHeader.isBlank()) {
            return countryHeader.trim();
        }

        if (ipAddress == null || ipAddress.isBlank()) {
            return "Unknown Location";
        }

        String ip = ipAddress.trim();

        // 2. Local / Private IP detection
        if (isLocalOrPrivateIp(ip)) {
            return "Local Network";
        }

        // 3. Check Redis cache first (0ms latency hit)
        String cacheKey = GEOIP_CACHE_PREFIX + ip;
        if (redisTemplate != null) {
            try {
                String cached = redisTemplate.opsForValue().get(cacheKey);
                if (cached != null && !cached.isBlank()) {
                    return cached;
                }
            } catch (Exception e) {
                log.debug("Redis GeoIP cache read error for IP [{}]: {}", ip, e.getMessage());
            }
        }

        // 4. Remote Lookup via public GeoIP service (ip-api.com) with strict 1.5s timeout
        String location = "Unknown Location";
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("http://ip-api.com/json/" + ip + "?fields=status,country,city"))
                    .timeout(Duration.ofMillis(1500))
                    .header("Accept", "application/json")
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 200 && response.body() != null && !response.body().isBlank()) {
                JsonNode root = objectMapper.readTree(response.body());
                if ("success".equalsIgnoreCase(root.path("status").asText())) {
                    String city = root.path("city").asText();
                    String country = root.path("country").asText();
                    if (!city.isBlank() && !country.isBlank()) {
                        location = city + ", " + country;
                    } else if (!country.isBlank()) {
                        location = country;
                    } else if (!city.isBlank()) {
                        location = city;
                    }
                }
            }
        } catch (Exception e) {
            log.debug("GeoIP lookup failed for IP [{}]: {}", ip, e.getMessage());
        }

        // 5. Cache resolved location in Redis
        if (redisTemplate != null && !location.equals("Unknown Location")) {
            try {
                redisTemplate.opsForValue().set(cacheKey, location, CACHE_TTL);
            } catch (Exception e) {
                log.debug("Failed to cache GeoIP in Redis for IP [{}]: {}", ip, e.getMessage());
            }
        }

        return location;
    }

    public boolean isLocalOrPrivateIp(String ip) {
        if ("127.0.0.1".equals(ip) || "localhost".equalsIgnoreCase(ip)
                || "0:0:0:0:0:0:0:1".equals(ip) || "::1".equals(ip)) {
            return true;
        }
        if (ip.startsWith("10.") || ip.startsWith("192.168.")) {
            return true;
        }
        if (ip.startsWith("172.")) {
            String[] parts = ip.split("\\.");
            if (parts.length >= 2) {
                try {
                    int second = Integer.parseInt(parts[1]);
                    if (second >= 16 && second <= 31) {
                        return true;
                    }
                } catch (NumberFormatException ignored) {
                }
            }
        }
        return false;
    }
}
