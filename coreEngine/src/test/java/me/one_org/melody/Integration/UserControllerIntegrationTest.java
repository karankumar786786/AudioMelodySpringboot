package me.one_org.melody.Integration;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import me.one_org.melody.Controllers.User.UserController;
import me.one_org.melody.Entity.User;
import me.one_org.melody.Services.General.UserService;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(MockitoExtension.class)
class UserControllerIntegrationTest {

    private MockMvc mockMvc;

    @Mock
    private UserService userService;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new UserController(userService))
                .setCustomArgumentResolvers(new me.one_org.melody.Utils.CurrentUserTestArgumentResolver())
                .build();
    }

    @Test
    @DisplayName("GET /api/user/profile should return current user profile")
    void shouldReturnProfile() throws Exception {
        User user = User.builder().id("u-1").userName("karan").email("karan@melody.com").build();
        when(userService.getUserProfile("u-1")).thenReturn(user);

        mockMvc.perform(get("/api/user/profile")
                        .requestAttr("userId", "u-1")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("u-1"))
                .andExpect(jsonPath("$.userName").value("karan"))
                .andExpect(jsonPath("$.email").value("karan@melody.com"));
    }

    @Test
    @DisplayName("PUT /api/user/profile should update user profile")
    void shouldUpdateProfile() throws Exception {
        User user = User.builder().id("u-1").userName("karan_pro").email("karan@melody.com").build();
        when(userService.updateProfile("u-1", "karan_pro")).thenReturn(user);

        mockMvc.perform(put("/api/user/profile")
                        .requestAttr("userId", "u-1")
                        .param("userName", "karan_pro")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userName").value("karan_pro"));

        verify(userService).updateProfile("u-1", "karan_pro");
    }
}
