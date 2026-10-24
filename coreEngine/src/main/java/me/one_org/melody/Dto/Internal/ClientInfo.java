package me.one_org.melody.Dto.Internal;

public record ClientInfo(
    String ipAddress,
    String userAgent,
    String deviceName
) {
    public static ClientInfo of(String ipAddress, String userAgent, String deviceName) {
        return new ClientInfo(ipAddress, userAgent, deviceName);
    }

    public static ClientInfo fallback() {
        return new ClientInfo("127.0.0.1", "Unknown", "Web Browser");
    }
}
