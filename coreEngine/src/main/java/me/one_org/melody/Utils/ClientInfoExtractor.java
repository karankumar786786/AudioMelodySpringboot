package me.one_org.melody.Utils;

import jakarta.servlet.http.HttpServletRequest;

public final class ClientInfoExtractor {

    private ClientInfoExtractor() {
    }

    public static String getClientIp(HttpServletRequest request) {
        if (request == null) {
            return "127.0.0.1";
        }
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isBlank() && !"unknown".equalsIgnoreCase(xForwardedFor)) {
            // First IP in comma-separated chain
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
