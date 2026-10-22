package me.one_org.melody.Integration;

import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import me.one_org.melody.Controllers.Api.UserHistoryApiController;
import me.one_org.melody.Dto.Controllers.Api.SaveSearchHistoryRequestDto;
import me.one_org.melody.Dto.Controllers.Api.UserSearchHistoryGroupedResponseDto;
import me.one_org.melody.Services.Api.UserHistoryApiService;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class UserHistoryApiControllerIntegrationTest {

    private MockMvc mockMvc;

    @Mock
    private UserHistoryApiService userHistoryApiService;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new UserHistoryApiController(userHistoryApiService))
                .setCustomArgumentResolvers(new me.one_org.melody.Utils.CurrentUserTestArgumentResolver())
                .build();
    }

    @Test
    @DisplayName("GET /api/user/history/search should return search history")
    void shouldReturnSearchHistory() throws Exception {
        UserSearchHistoryGroupedResponseDto grouped = new UserSearchHistoryGroupedResponseDto(
                List.of(), List.of(), List.of(), List.of(), List.of()
        );
        when(userHistoryApiService.getSearchHistory("u-1")).thenReturn(grouped);

        mockMvc.perform(get("/api/user/history/search")
                        .requestAttr("userId", "u-1")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("POST /api/user/history/search should record search query and return 200 OK")
    void shouldSaveSearchHistory() throws Exception {
        mockMvc.perform(post("/api/user/history/search")
                        .requestAttr("userId", "u-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"SONG\",\"songId\":\"song-123\"}"))
                .andExpect(status().isOk());

        verify(userHistoryApiService).saveSearchHistory(eq("u-1"), any(SaveSearchHistoryRequestDto.class));
    }

    @Test
    @DisplayName("DELETE /api/user/history/search/{id} should delete single item and return 200 OK")
    void shouldDeleteSearchItem() throws Exception {
        mockMvc.perform(delete("/api/user/history/search/item-55")
                        .requestAttr("userId", "u-1"))
                .andExpect(status().isOk());

        verify(userHistoryApiService).deleteSearchHistoryItem("u-1", "item-55");
    }

    @Test
    @DisplayName("DELETE /api/user/history/search should clear search history and return 200 OK")
    void shouldClearSearchHistory() throws Exception {
        mockMvc.perform(delete("/api/user/history/search")
                        .requestAttr("userId", "u-1"))
                .andExpect(status().isOk());

        verify(userHistoryApiService).clearSearchHistory("u-1");
    }
}
