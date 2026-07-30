package me.one_org.melody.Entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "user_search_history")
@Data
@AllArgsConstructor
@Builder
public class UserSearchHistoryEntity {

    @Id
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private UsersEntity user;

    @Column(nullable = false)
    private String searchedText;
}
