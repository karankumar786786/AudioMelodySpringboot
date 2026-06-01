package me.one_org.melody.Entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "artists")
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class Artists {

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

