package me.one_org.melody.Configuration;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * Environment-configurable cookie properties.
 *
 * Production: domain=.one-org.me, secure=true, sameSite=None
 * Local dev:  domain=localhost,    secure=false, sameSite=Lax
 */
@Configuration
@ConfigurationProperties(prefix = "cookie")
public class CookieProperties {

    private String domain = "";
    private boolean secure = false;
    private String sameSite = "Lax";
    private long accessMaxAgeSeconds = 300;       // 5 minutes — matches JWT access token TTL
    private long refreshMaxAgeSeconds = 604800;   // 7 days — matches refresh token TTL

    public String getDomain() { return domain; }
    public void setDomain(String domain) { this.domain = domain; }

    public boolean isSecure() { return secure; }
    public void setSecure(boolean secure) { this.secure = secure; }

    public String getSameSite() { return sameSite; }
    public void setSameSite(String sameSite) { this.sameSite = sameSite; }

    public long getAccessMaxAgeSeconds() { return accessMaxAgeSeconds; }
    public void setAccessMaxAgeSeconds(long accessMaxAgeSeconds) { this.accessMaxAgeSeconds = accessMaxAgeSeconds; }

    public long getRefreshMaxAgeSeconds() { return refreshMaxAgeSeconds; }
    public void setRefreshMaxAgeSeconds(long refreshMaxAgeSeconds) { this.refreshMaxAgeSeconds = refreshMaxAgeSeconds; }
}
