package me.one_org.melody.Services.General;

import java.util.Optional;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import me.one_org.melody.Entity.User;
import me.one_org.melody.Repository.UsersRepository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock
    private UsersRepository usersRepository;

    @InjectMocks
    private UserService userService;

    @Test
    @DisplayName("getUserProfile should return user or throw 404")
    void getUserProfile() {
        User user = User.builder().id("u-1").userName("karan").email("k@melody.com").build();
        when(usersRepository.findById("u-1")).thenReturn(Optional.of(user));
        when(usersRepository.findById("u-none")).thenReturn(Optional.empty());

        assertThat(userService.getUserProfile("u-1").getUserName()).isEqualTo("karan");
        assertThatThrownBy(() -> userService.getUserProfile("u-none"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("User not found");
    }

    @Test
    @DisplayName("updateProfile should update userName and save user")
    void updateProfile() {
        User user = User.builder().id("u-1").userName("old_name").email("k@melody.com").build();
        when(usersRepository.findById("u-1")).thenReturn(Optional.of(user));

        User updated = userService.updateProfile("u-1", "new_name");

        assertThat(updated.getUserName()).isEqualTo("new_name");
        verify(usersRepository).save(user);
    }
}
