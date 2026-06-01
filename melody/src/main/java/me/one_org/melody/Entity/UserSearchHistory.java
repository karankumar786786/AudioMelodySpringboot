package me.one_org.melody.Entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "user_search_history")
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class UserSearchHistory {

    @Id
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private Users user;

    @Column(nullable = false)
    private String searchedText;
}
