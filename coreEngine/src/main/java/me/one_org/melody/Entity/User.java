package me.one_org.melody.Entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.Email;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import me.one_org.melody.Enums.RoleEnum;
import me.one_org.melody.Enums.StatusEnum;

import java.time.LocalDateTime;

/**
 * Table: users
 * App ka listener (user): id, naam, email, status.
 * Login OTP se hota hai, isliye password column nahi hai. Har user ka role USER hai.
 *
 * Entity = Java class jo database ki ek table se juda hai; har object = table ki ek row.
 * Table Flyway migrations (migration/ module) banate hain, ye class sirf usko map karti hai.
 */
@Entity
@Table(name = "users")
@Data
public class User {

    @Id
    private String id;

    @Column(nullable = false)
    private String userName;

    @Column(nullable = false, unique = true)
    @Email
    private String email;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private StatusEnum status = StatusEnum.ACTIVE;

    @CreationTimestamp
    private LocalDateTime createdAt;

    public User() {
        super();
    }

    @Builder
    public User(String id, String userName, String email, StatusEnum status, LocalDateTime createdAt) {
        super();
        this.id = id;
        this.userName = userName;
        this.email = email;
        this.status = status != null ? status : StatusEnum.ACTIVE;
        this.createdAt = createdAt;
    }

    /** Har app user ka role USER hai (admins alag system me hain), isliye column nahi chahiye. */
    public RoleEnum getRole() {
        return RoleEnum.USER;
    }
}