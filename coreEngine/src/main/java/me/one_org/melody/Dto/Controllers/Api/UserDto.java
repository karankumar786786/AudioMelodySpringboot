package me.one_org.melody.Dto.Controllers.Api;

import java.time.LocalDateTime;
import me.one_org.melody.Entity.User;
import me.one_org.melody.Enums.RoleEnum;
import me.one_org.melody.Enums.StatusEnum;

public record UserDto(
    String id,
    String userName,
    String email,
    StatusEnum status,
    RoleEnum role,
    LocalDateTime createdAt
) {
    public static UserDto fromEntity(User user) {
        if (user == null) return null;
        return new UserDto(
            user.getId(),
            user.getUserName(),
            user.getEmail(),
            user.getStatus(),
            user.getRole(),
            user.getCreatedAt()
        );
    }
}
