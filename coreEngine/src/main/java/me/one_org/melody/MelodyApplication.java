package me.one_org.melody;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cache.annotation.EnableCaching;

@SpringBootApplication
@EnableCaching
public class MelodyApplication {

	public static void main(String[] args) {
		SpringApplication.run(MelodyApplication.class, args);
	}

}
