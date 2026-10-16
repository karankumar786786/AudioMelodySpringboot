package me.one_org.melody.Controllers.User;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import me.one_org.melody.Dto.Controllers.Api.UserDto;
import me.one_org.melody.Dto.Controllers.User.UpdateProfileRequestDto;
import me.one_org.melody.Entity.User;
import me.one_org.melody.Services.General.UserService;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserControllerTest {

    @Mock
    private UserService userService;

    @InjectMocks
    private UserController userController;

    @Test
    @DisplayName("Should get user profile")
    void shouldGetUserProfile() {
        User user = User.builder()
                .id("user-1")
                .userName("karan")
                .email("karan@example.com")
                .build();
        when(userService.getUserProfile("user-1")).thenReturn(user);

        ResponseEntity<UserDto> response = userController.getProfile("user-1");

        assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().userName()).isEqualTo("karan");
    }

    @Test
    @DisplayName("Should update user profile via JSON body")
    void shouldUpdateProfileViaJsonBody() {
        User updated = User.builder()
                .id("user-1")
                .userName("Karan Kumar")
                .email("karan@example.com")
                .build();
        when(userService.updateProfile("user-1", "Karan Kumar")).thenReturn(updated);

        UpdateProfileRequestDto body = new UpdateProfileRequestDto("Karan Kumar");
        ResponseEntity<UserDto> response = userController.updateProfile("user-1", null, body);

        assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().userName()).isEqualTo("Karan Kumar");
    }

    @Test
    @DisplayName("Should update user profile via request param")
    void shouldUpdateProfileViaRequestParam() {
        User updated = User.builder()
                .id("user-1")
                .userName("Karan Param")
                .email("karan@example.com")
                .build();
        when(userService.updateProfile("user-1", "Karan Param")).thenReturn(updated);

        ResponseEntity<UserDto> response = userController.updateProfile("user-1", "Karan Param", null);

        assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().userName()).isEqualTo("Karan Param");
    }
}
