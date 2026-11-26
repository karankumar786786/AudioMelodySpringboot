package me.one_org.melody.Configuration;

import javax.sql.DataSource;

import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.zaxxer.hikari.HikariDataSource;

import lombok.extern.slf4j.Slf4j;

/**
 * Server start hote hi database connection pool (HikariCP) ki settings log me print karta hai.
 * Connection pool = pehle se bane hue DB connections ka group, jinko requests baari baari use karti hain,
 * taaki har request pe naya connection na banana pade.
 * Ye sirf debugging ke liye hai - behaviour pe koi asar nahi.
 */
@Configuration
@Slf4j
public class DataSourceConfig {

    /** Startup pe ek baar chalta hai aur pool ki settings print karta hai. */
    @Bean
    public CommandLineRunner logDataSourcePoolInfo(DataSource dataSource) {
        return args -> {
            if (dataSource instanceof HikariDataSource hikari) {
                log.info("==================================================================");
                log.info("⚡ [HikariCP Connection Pool Configured & Active]");
                log.info("   Pool Name:          {}", hikari.getPoolName());
                log.info("   Maximum Pool Size:  {}", hikari.getMaximumPoolSize());
                log.info("   Minimum Idle:       {}", hikari.getMinimumIdle());
                log.info("   Connection Timeout: {} ms", hikari.getConnectionTimeout());
                log.info("   Idle Timeout:       {} ms", hikari.getIdleTimeout());
                log.info("   Max Lifetime:       {} ms", hikari.getMaxLifetime());
                log.info("   Leak Detection:     {} ms", hikari.getLeakDetectionThreshold());
                log.info("   JDBC Driver:        {}", hikari.getDriverClassName());
                log.info("==================================================================");
            } else {
                log.warn("⚠️ DataSource is NOT HikariDataSource: {}", dataSource != null ? dataSource.getClass().getName() : "null");
            }
        };
    }
}
