package me.one_org.melody.Entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.io.Serializable;
import java.time.LocalDateTime;

@Entity
@Table(name = "artists")
@Data
@AllArgsConstructor
@Builder
public class Artists implements Serializable {

    @Id
    private String id;

    @Column(nullable = false)
    private String name;

    private String about;

    private LocalDateTime dob;

    private String coverImageKey;

    private String bannerImageKey;

    @CreationTimestamp
    private LocalDateTime createdAt;

}

