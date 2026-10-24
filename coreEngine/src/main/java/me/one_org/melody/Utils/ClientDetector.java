package me.one_org.melody.Utils;

import org.springframework.stereotype.Component;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;

/**
 * Utility to detect if an incoming HTTP request originates from a web browser
 * (which requires HttpOnly cookies) or a non-browser client (mobile app, CLI, etc.).
 */
@Component
public class ClientDetector {

    public boolean isBrowser(HttpServletRequest request) {
        if (request == null) {
            return false;
        }

        // 1. Modern browser fetch metadata headers (Sec-Fetch-*, Sec-CH-UA)
        if (request.getHeader("Sec-Fetch-Dest") != null || request.getHeader("Sec-Fetch-Mode") != null
                || request.getHeader("Sec-CH-UA") != null) {
            return true;
        }

        // 2. Web origins (Origin or Referer present)
        String origin = request.getHeader("Origin");
        if (origin != null && !origin.isBlank()) {
            return true;
        }

        // 3. Presence of existing auth cookies (system_token or system_refresh_token)
        Cookie[] cookies = request.getCookies();
        if (cookies != null) {
            for (Cookie c : cookies) {
                if ("system_token".equals(c.getName()) || "system_refresh_token".equals(c.getName())) {
                    return true;
                }
            }
        }

        // 4. User-Agent heuristic
        String ua = request.getHeader("User-Agent");
        if (ua != null) {
            String lower = ua.toLowerCase();
            boolean hasBrowserToken = lower.contains("mozilla") || lower.contains("chrome")
                    || lower.contains("safari") || lower.contains("firefox") || lower.contains("edge")
                    || lower.contains("webkit");
            boolean isNonBrowser = lower.contains("okhttp") || lower.contains("cfnetwork")
                    || lower.contains("postman") || lower.contains("curl") || lower.contains("dalvik");
            if (hasBrowserToken && !isNonBrowser) {
                return true;
            }
        }

        return false;
    }
}
