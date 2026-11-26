package me.one_org.melody.Aspects;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Ye annotation kisi method ya class pe lagao to CentralizedLoggingAspect uski
 * START / SUCCESS / FAILURE logging nahi karega.
 * Kaam aata hai un methods pe jo bahut baar chalte hain (log spam) ya jinke
 * arguments me sensitive data ho sakta hai.
 */
@Target({ElementType.METHOD, ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
public @interface NoLogging {
}
