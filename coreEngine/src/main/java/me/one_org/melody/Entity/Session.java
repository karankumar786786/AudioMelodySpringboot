package me.one_org.melody.Entity;

import java.time.LocalDateTime;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;
import org.hibernate.annotations.UpdateTimestamp;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Builder;
import lombok.Data;

@Entity
@Table(
    name = "sessions",
    uniqueConstraints = @UniqueConstraint(
        name = "uk_user_device_session",
        columnNames = { "user_id", "device_id" }
    ),
    indexes = {
        @Index(name = "idx_session_user_device", columnList = "user_id, device_id"),
        @Index(name = "idx_session_refresh_token", columnList = "refresh_token")
    }
)
@Data
public class Session {

    @Id
    private String id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private User user;

    @Column(name = "device_id", nullable = false)
    private String deviceId;

    @Column(name = "refresh_token", nullable = false, length = 1000)
    private String refreshToken;

    @Column(name = "previous_refresh_token", length = 1000)
    private String previousRefreshToken;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public Session() {
        super();
    }

    @Builder
    public Session(String id, User user, String deviceId, String refreshToken,
                   String previousRefreshToken, LocalDateTime expiresAt,
                   LocalDateTime createdAt, LocalDateTime updatedAt) {
        super();
        this.id = id;
        this.user = user;
        this.deviceId = deviceId;
        this.refreshToken = refreshToken;
        this.previousRefreshToken = previousRefreshToken;
        this.expiresAt = expiresAt;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }
}
