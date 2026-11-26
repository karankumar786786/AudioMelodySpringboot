package me.one_org.melody;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Core API ka starting point (main class).
 *
 * Mobile app aur web player dono isi Spring Boot server ko call karte hain:
 * songs, search, library, login, shorts, listening telemetry - sab yahin aata hai.
 *
 * Annotations ka matlab:
 * - @SpringBootApplication : Spring ko bolta hai ki is package ke andar ke saare
 *   @Controller / @Service / @Component khud dhoondh ke bana de.
 * - @EnableCaching   : @Cacheable wale methods ka result Redis me cache hoga (RedisConfig dekho).
 * - @EnableAsync     : @Async wale methods alag thread pe chalenge, request ko wait nahi karna padega.
 * - @EnableScheduling: @Scheduled wale methods time pe khud chalenge (jaise purane sessions saaf karna).
 */
@SpringBootApplication
@EnableCaching
@EnableAsync
@EnableScheduling
public class MelodyApplication {

	/** Yahan se poora server start hota hai. */
	public static void main(String[] args) {
		SpringApplication.run(MelodyApplication.class, args);
	}

}
