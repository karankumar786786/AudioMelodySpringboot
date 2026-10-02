package one_org.migration;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationInfo;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;

@SpringBootApplication
public class MigrationApplication {

	private static final Logger log = LoggerFactory.getLogger(MigrationApplication.class);

	public static void main(String[] args) {
		SpringApplication.run(MigrationApplication.class, args);
	}

	@Bean
	public CommandLineRunner migrationReporter(Flyway flyway) {
		return args -> {
			log.info("============================================================");
			log.info(" Flyway Database Migration Summary");
			log.info("============================================================");
			MigrationInfo current = flyway.info().current();
			if (current != null) {
				log.info(" Current Schema Version : {}", current.getVersion());
				log.info(" Current Description    : {}", current.getDescription());
				log.info(" Execution State        : {}", current.getState());
				log.info(" Installed On           : {}", current.getInstalledOn());
			} else {
				log.info(" No migrations currently recorded in schema history table.");
			}
			log.info(" Applied Migrations:");
			for (MigrationInfo info : flyway.info().applied()) {
				log.info("  -> [{}] {} (State: {}, Time: {}ms)",
						info.getVersion(), info.getDescription(), info.getState(), info.getExecutionTime());
			}
			log.info("============================================================");
		};
	}
}
