package me.one_org.melody;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableCaching
@EnableAsync
public class MelodyApplication {

	public static void main(String[] args) {
		SpringApplication.run(MelodyApplication.class, args);
	}

}
