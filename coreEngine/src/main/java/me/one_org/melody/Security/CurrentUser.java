package me.one_org.melody.Security;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

import org.springframework.security.core.annotation.AuthenticationPrincipal;

/**
 * Shortcut annotation: controller parameter pe lagao to login kiya hua user mil jaata hai.
 * Example:
 *   public ResponseEntity<?> getMyProfile(@CurrentUser CustomUserDetails currentUser)
 * Andar se ye Spring ka @AuthenticationPrincipal hi hai, bas naam chhota aur saaf hai.
 */
@Target({ElementType.PARAMETER, ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
@Documented
@AuthenticationPrincipal
public @interface CurrentUser {
}
