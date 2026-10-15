package me.one_org.melody.Entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.io.Serializable;
import java.time.LocalDateTime;

import me.one_org.melody.Enums.StatusEnum;

@Entity
@Table(name = "artists")
@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class Artist implements Serializable {

    @Id
    private String id;

    @Column(nullable = false)
    private String name;
    @Column(nullable = false)
    private String about;

    @Column(nullable = false)
    private LocalDateTime dob;

    @Column(nullable = false)
    private String coverImageKey;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private StatusEnum status;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

}

