package me.one_org.melody.Utils;

import jakarta.servlet.http.HttpServletRequest;

/**
 * HTTP request se client ki info nikalne wale chhote helper functions:
 * asli IP address, koi header, aur User-Agent se device ka naam.
 * Login sessions me "kaunsa device, kahan se" dikhane ke liye use hota hai.
 */
public final class ClientInfoExtractor {

    // Sirf static methods hain, isliye object banane ki zaroorat nahi.
    private ClientInfoExtractor() {
    }

    /**
     * User ka asli IP address.
     * Hamara server Cloudflare / Caddy (reverse proxy) ke peeche hai, isliye
     * request.getRemoteAddr() me proxy ka IP aata hai. Asli IP proxy headers me hota hai,
     * to un headers ko is order me check karte hain:
     * CF-Connecting-IP -> X-Forwarded-For (pehla IP) -> X-Real-IP -> remoteAddr.
     * Kuch na mile to "127.0.0.1".
     */
    public static String getClientIp(HttpServletRequest request) {
        if (request == null) {
            return "127.0.0.1";
        }
        // Cloudflare asli user ka IP is header me bhejta hai
        String cfConnectingIp = request.getHeader("CF-Connecting-IP");
        if (cfConnectingIp != null && !cfConnectingIp.isBlank() && !"unknown".equalsIgnoreCase(cfConnectingIp)) {
            return cfConnectingIp.trim();
        }
        // Normal reverse proxy wala header
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isBlank() && !"unknown".equalsIgnoreCase(xForwardedFor)) {
            // Isme "client, proxy1, proxy2" jaisi list hoti hai - pehla IP asli user ka hai
            int commaIdx = xForwardedFor.indexOf(',');
            return commaIdx > 0 ? xForwardedFor.substring(0, commaIdx).trim() : xForwardedFor.trim();
        }
        String xRealIp = request.getHeader("X-Real-IP");
        if (xRealIp != null && !xRealIp.isBlank() && !"unknown".equalsIgnoreCase(xRealIp)) {
            return xRealIp.trim();
        }
        String remoteAddr = request.getRemoteAddr();
        return (remoteAddr != null && !remoteAddr.isBlank()) ? remoteAddr : "127.0.0.1";
    }

    /**
     * Diye gaye headers me se jo pehla header khaali nahi hai uski value deta hai.
     * Koi na mile (ya value "unknown" ho) to null.
     */
    public static String getHeaderOrNull(HttpServletRequest request, String... headerNames) {
        if (request == null || headerNames == null) {
            return null;
        }
        for (String name : headerNames) {
            String val = request.getHeader(name);
            if (val != null && !val.isBlank() && !"unknown".equalsIgnoreCase(val)) {
                return val.trim();
            }
        }
        return null;
    }

    /**
     * User-Agent string se readable device naam banata hai, jaise "Android (Chrome)".
     * User-Agent = browser/app har request ke saath apni pehchaan bhejta hai.
     * Pehle OS dhoondte hain, phir browser. Order zaroori hai: Edge ke UA me "Chrome"
     * bhi likha hota hai, aur Chrome ke UA me "Safari" bhi.
     */
    public static String parseDeviceName(String userAgent) {
        if (userAgent == null || userAgent.isBlank()) {
            return "Web Browser";
        }

        String os = "Unknown OS";
        if (userAgent.contains("iPhone")) {
            os = "iPhone";
        } else if (userAgent.contains("iPad")) {
            os = "iPad";
        } else if (userAgent.contains("Android")) {
            os = "Android";
        } else if (userAgent.contains("Macintosh") || userAgent.contains("Mac OS X")) {
            os = "macOS";
        } else if (userAgent.contains("Windows")) {
            os = "Windows";
        } else if (userAgent.contains("Linux")) {
            os = "Linux";
        }

        String browser = "Browser";
        if (userAgent.contains("Edg/")) {
            browser = "Edge";
        } else if (userAgent.contains("Chrome/") && !userAgent.contains("Edg/")) {
            browser = "Chrome";
        } else if (userAgent.contains("Safari/") && !userAgent.contains("Chrome/")) {
            browser = "Safari";
        } else if (userAgent.contains("Firefox/")) {
            browser = "Firefox";
        }

        return os + " (" + browser + ")";
    }
}
