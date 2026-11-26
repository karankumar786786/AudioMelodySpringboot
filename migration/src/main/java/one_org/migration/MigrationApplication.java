package one_org.migration;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationInfo;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;

/**
 * Database migrations chalane wala chhota app (Flyway).
 *
 * Flyway = database schema ka version control. db/migration/V1__..., V2__... SQL files order me chalti hain,
 * aur jo chal chuki unka record flyway_schema_history table me rehta hai. Deploy se pehle ye app ek baar chalta hai.
 * YAAD RAKHO: jo migration production me chal chuki use kabhi edit mat karo (checksum badal jaata hai) -
 * hamesha nayi V<number>__ file banao.
 */
@SpringBootApplication
public class MigrationApplication {

	private static final Logger log = LoggerFactory.getLogger(MigrationApplication.class);

	/** App start: Spring Boot Flyway ko khud chala deta hai. */
	public static void main(String[] args) {
		SpringApplication.run(MigrationApplication.class, args);
	}

	/** Migration ke baad summary print karo: abhi ka version aur saari migrations ki list. */
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
