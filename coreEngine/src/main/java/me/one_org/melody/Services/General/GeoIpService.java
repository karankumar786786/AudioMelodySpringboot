package me.one_org.melody.Services.General;

import java.io.File;
import java.io.InputStream;
import java.net.InetAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.maxmind.db.CHMCache;
import com.maxmind.geoip2.DatabaseReader;
import com.maxmind.geoip2.exception.AddressNotFoundException;
import com.maxmind.geoip2.model.CityResponse;

import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;

@Service
@Slf4j
public class GeoIpService implements AutoCloseable {

    private static final String GEOIP_CACHE_PREFIX = "geoip:cache:";
    private static final Duration CACHE_TTL = Duration.ofDays(7);

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private DatabaseReader databaseReader;

    @Autowired
    public GeoIpService(
            @Autowired(required = false) StringRedisTemplate redisTemplate,
            @Value("${geoip.database-path:}") String configuredDbPath) {
        this.redisTemplate = redisTemplate;
        this.objectMapper = new ObjectMapper();
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofMillis(1200))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
        initDatabaseReader(configuredDbPath);
    }

    public GeoIpService(StringRedisTemplate redisTemplate, ObjectMapper objectMapper) {
        this.redisTemplate = redisTemplate;
        this.objectMapper = objectMapper != null ? objectMapper : new ObjectMapper();
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofMillis(1200))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
        initDatabaseReader(null);
    }

    public GeoIpService() {
        this(null, new ObjectMapper());
    }

    private void initDatabaseReader(String customPath) {
        try {
            // 1. Try custom configured path if provided
            if (customPath != null && !customPath.isBlank()) {
                File customFile = new File(customPath);
                if (customFile.exists() && customFile.canRead()) {
                    this.databaseReader = new DatabaseReader.Builder(customFile)
                            .withCache(new CHMCache())
                            .build();
                    log.info("Initialized MaxMind GeoIP2 database from custom path: {}", customPath);
                    return;
                }
            }

            // 2. Try filesystem development/production paths
            Path[] candidatePaths = new Path[] {
                Path.of("src/main/resources/geoip/GeoLite2-City.mmdb"),
                Path.of("target/classes/geoip/GeoLite2-City.mmdb"),
                Path.of("coreEngine/src/main/resources/geoip/GeoLite2-City.mmdb"),
                Path.of("geoip/GeoLite2-City.mmdb")
            };

            for (Path candidate : candidatePaths) {
                if (Files.exists(candidate) && Files.isReadable(candidate)) {
                    this.databaseReader = new DatabaseReader.Builder(candidate.toFile())
                            .withCache(new CHMCache())
                            .build();
                    log.info("Initialized MaxMind GeoIP2 database from candidate path: {}", candidate);
                    return;
                }
            }

            // 3. Try classpath resource stream
            InputStream is = getClass().getClassLoader().getResourceAsStream("geoip/GeoLite2-City.mmdb");
            if (is != null) {
                this.databaseReader = new DatabaseReader.Builder(is)
                        .withCache(new CHMCache())
                        .build();
                log.info("Initialized MaxMind GeoIP2 database from classpath resource.");
                return;
            }

            log.info("No local MaxMind GeoLite2-City.mmdb found. Operating in Redis-cached HTTP fallback mode.");
        } catch (Exception e) {
            log.warn("Failed to initialize MaxMind DatabaseReader: {}. Falling back to Redis/HTTP.", e.getMessage());
        }
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

        // 3. Offline MaxMind GeoIP2 resolution (0 network calls, sub-millisecond in-memory speed)
        if (databaseReader != null) {
            try {
                InetAddress inetAddress = InetAddress.getByName(ip);
                CityResponse cityResponse = databaseReader.city(inetAddress);
                if (cityResponse != null) {
                    String city = cityResponse.getCity() != null ? cityResponse.getCity().getName() : null;
                    String country = cityResponse.getCountry() != null ? cityResponse.getCountry().getName() : null;
                    if (city != null && !city.isBlank() && country != null && !country.isBlank()) {
                        return city + ", " + country;
                    } else if (country != null && !country.isBlank()) {
                        return country;
                    } else if (city != null && !city.isBlank()) {
                        return city;
                    }
                }
            } catch (AddressNotFoundException ignored) {
                // Address not present in local MaxMind database, proceed to online/cache fallback
            } catch (Exception e) {
                log.debug("MaxMind lookup error for IP [{}]: {}", ip, e.getMessage());
            }
        }

        // 4. Check Redis cache (0ms latency hit)
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

        // 5. Remote Lookup via public GeoIP service (ip-api.com) with strict 1.5s timeout
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
            log.debug("GeoIP remote lookup failed for IP [{}]: {}", ip, e.getMessage());
        }

        // 6. Cache resolved location in Redis
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

    public boolean isMaxMindAvailable() {
        return databaseReader != null;
    }

    @Override
    @PreDestroy
    public void close() {
        if (databaseReader != null) {
            try {
                databaseReader.close();
            } catch (Exception ignored) {
            }
        }
    }
}
