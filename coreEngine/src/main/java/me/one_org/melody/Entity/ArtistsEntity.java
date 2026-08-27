package me.one_org.melody.Entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.io.Serializable;
import java.time.LocalDateTime;

import lombok.Builder.Default;
import me.one_org.melody.Enums.StatusEnum;

@Entity
@Table(name = "artists")
@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class ArtistsEntity implements Serializable {

    @Id
    private String id;

    @Column(nullable = false)
    private String name;

    private String about;

    private LocalDateTime dob;

    private String coverImageKey;

    @Default
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private StatusEnum status = StatusEnum.ACTIVE;

    @CreationTimestamp
    private LocalDateTime createdAt;

}

