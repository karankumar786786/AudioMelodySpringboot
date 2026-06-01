package me.one_org.melody;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import com.algolia.api.SearchClient;

@SpringBootTest
class MelodyApplicationTests {

	@Test
	void contextLoads() {
		for (Method method : SearchClient.class.getDeclaredMethods()) {
			if (Modifier.isPublic(method.getModifiers())) {
				System.out.println("METHOD: " + method.toString());
			}
		}
	}

}
