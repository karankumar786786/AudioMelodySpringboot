package me.one_org.melody.Entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.Email;
import lombok.*;
import lombok.Builder.Default;
import org.hibernate.annotations.CreationTimestamp;

import me.one_org.melody.Enums.RoleEnum;
import me.one_org.melody.Enums.StatusEnum;

import java.time.LocalDateTime;

@Entity
@Table(name = "users")
@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class User {

    @Id
    private String id;

    @Column(nullable = false)
    private String userName;

    @Column(nullable = false, unique = true)
    @Email
    private String email;

    @Default
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private StatusEnum status = StatusEnum.ACTIVE;

    @CreationTimestamp
    private LocalDateTime createdAt;

    public RoleEnum getRole() {
        return me.one_org.melody.Enums.RoleEnum.USER;
    }
}