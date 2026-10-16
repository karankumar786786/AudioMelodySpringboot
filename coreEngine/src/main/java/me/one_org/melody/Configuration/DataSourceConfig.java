package me.one_org.melody.Configuration;

import javax.sql.DataSource;

import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.zaxxer.hikari.HikariDataSource;

import lombok.extern.slf4j.Slf4j;

/**
 * Verifies and logs HikariCP connection pool configuration on boot.
 */
@Configuration
@Slf4j
public class DataSourceConfig {

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
