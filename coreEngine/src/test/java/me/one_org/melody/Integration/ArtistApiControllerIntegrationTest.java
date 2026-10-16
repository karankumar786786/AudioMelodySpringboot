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

import me.one_org.melody.Controllers.Api.ArtistApiController;
import me.one_org.melody.Dto.Controllers.Api.ArtistDto;
import me.one_org.melody.Dto.Controllers.Api.ArtistFollowStatusDto;
import me.one_org.melody.Dto.Controllers.Api.PaginationMetaDataDto;
import me.one_org.melody.Entity.Artist;
import me.one_org.melody.Entity.PaginationMetaData;
import me.one_org.melody.Services.Api.ArtistApiService;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(MockitoExtension.class)
class ArtistApiControllerIntegrationTest {

    private MockMvc mockMvc;

    @Mock
    private ArtistApiService artistApiService;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new ArtistApiController(artistApiService)).build();
    }

    @Test
    @DisplayName("GET /api/artists should return paginated artists list")
    void shouldReturnPaginatedArtists() throws Exception {
        Artist artist = Artist.builder().id("art-1").name("Queen").build();
        when(artistApiService.getArtistsPaginated(0, 20)).thenReturn(List.of(ArtistDto.fromEntity(artist)));
        when(artistApiService.getPaginationMetaData()).thenReturn(PaginationMetaDataDto.fromEntity(PaginationMetaData.builder().totalCount(1L).build()));

        mockMvc.perform(get("/api/artists")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].id").value("art-1"))
                .andExpect(jsonPath("$.content[0].name").value("Queen"));
    }

    @Test
    @DisplayName("GET /api/artists/{id} should return artist with Cache-Control header")
    void shouldReturnArtistWithCacheControl() throws Exception {
        Artist artist = Artist.builder().id("art-2").name("Coldplay").build();
        when(artistApiService.getArtistById("art-2")).thenReturn(ArtistDto.fromEntity(artist));

        mockMvc.perform(get("/api/artists/art-2")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(header().exists("Cache-Control"))
                .andExpect(jsonPath("$.id").value("art-2"))
                .andExpect(jsonPath("$.name").value("Coldplay"));
    }

    @Test
    @DisplayName("POST /api/artists/{id}/follow should return updated follow status")
    void shouldFollowArtist() throws Exception {
        ArtistFollowStatusDto statusDto = new ArtistFollowStatusDto("art-3", "Nirvana", 5000L, true);
        when(artistApiService.followArtist("u-1", "art-3")).thenReturn(statusDto);

        mockMvc.perform(post("/api/artists/art-3/follow")
                        .requestAttr("userId", "u-1")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.artistId").value("art-3"))
                .andExpect(jsonPath("$.followersCount").value(5000))
                .andExpect(jsonPath("$.isFollowing").value(true));
    }
}
