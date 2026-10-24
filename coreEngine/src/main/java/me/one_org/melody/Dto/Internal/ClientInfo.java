package me.one_org.melody.Dto.Internal;

public record ClientInfo(
    String ipAddress,
    String userAgent,
    String deviceName,
    String location
) {
    public ClientInfo(String ipAddress, String userAgent, String deviceName) {
        this(ipAddress, userAgent, deviceName, "Unknown Location");
    }

    public static ClientInfo of(String ipAddress, String userAgent, String deviceName, String location) {
        return new ClientInfo(ipAddress, userAgent, deviceName, location);
    }

    public static ClientInfo of(String ipAddress, String userAgent, String deviceName) {
        return new ClientInfo(ipAddress, userAgent, deviceName, "Unknown Location");
    }

    public static ClientInfo fallback() {
        return new ClientInfo("127.0.0.1", "Unknown", "Web Browser", "Local Network");
    }
}
