package me.one_org.melody.Services.Api;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageRequest;

import me.one_org.melody.Dto.Controllers.Api.SongDto;
import me.one_org.melody.Dto.Controllers.PaginatedResponseDto;
import me.one_org.melody.Entity.Song;
import me.one_org.melody.Repository.SongsRepository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class VideosApiServiceTest {

    @Mock
    private SongsRepository songsRepository;

    @InjectMocks
    private VideosApiService videosApiService;

    @Test
    @DisplayName("getVideos should return paginated videos with latest sort")
    void getVideosLatest() {
        Song videoSong = Song.builder()
                .id("v-1")
                .title("Video 1")
                .artistName("Artist A")
                .fullVideoKey("videos/v1.m3u8")
                .genre("Pop")
                .build();

        when(songsRepository.findVideosLatest(eq("Pop"), eq("Hindi"), any(PageRequest.class)))
                .thenReturn(List.of(videoSong));
        when(songsRepository.countVideos(eq("Pop"), eq("Hindi"))).thenReturn(1L);

        PaginatedResponseDto<SongDto> result = videosApiService.getVideos(0, 10, "Pop", "Hindi", "latest");

        assertThat(result.content()).hasSize(1);
        assertThat(result.content().get(0).title()).isEqualTo("Video 1");
        assertThat(result.page()).isEqualTo(0);
        assertThat(result.size()).isEqualTo(10);
        assertThat(result.paginationMetaData().totalCount()).isEqualTo(1L);
    }

    @Test
    @DisplayName("getVideos should return popular videos when sort is popular")
    void getVideosPopular() {
        Song videoSong = Song.builder()
                .id("v-2")
                .title("Popular Video")
                .artistName("Artist B")
                .fullVideoKey("videos/v2.m3u8")
                .build();

        when(songsRepository.findVideosPopular(isNull(), isNull(), any(PageRequest.class)))
                .thenReturn(List.of(videoSong));
        when(songsRepository.countVideos(isNull(), isNull())).thenReturn(1L);

        PaginatedResponseDto<SongDto> result = videosApiService.getVideos(0, 15, null, null, "popular");

        assertThat(result.content()).hasSize(1);
        assertThat(result.content().get(0).title()).isEqualTo("Popular Video");
    }

    @Test
    @DisplayName("getTrendingVideos should return trending list")
    void getTrendingVideos() {
        Song song = Song.builder()
                .id("v-trending")
                .title("Trending Video")
                .fullVideoKey("videos/trending.m3u8")
                .build();

        when(songsRepository.findTrendingVideos(eq(15), eq("7d"), isNull(), isNull()))
                .thenReturn(List.of(song));

        List<SongDto> result = videosApiService.getTrendingVideos(15, "7d", null, null);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).id()).isEqualTo("v-trending");
    }

    @Test
    @DisplayName("getRelatedVideos should query related by artist and genre")
    void getRelatedVideos() {
        Song current = Song.builder()
                .id("current-v")
                .title("Current Video")
                .artistName("Arijit Singh")
                .genre("Romantic")
                .fullVideoKey("videos/current.m3u8")
                .build();

        Song related = Song.builder()
                .id("related-v")
                .title("Related Video")
                .artistName("Arijit Singh")
                .genre("Romantic")
                .fullVideoKey("videos/related.m3u8")
                .build();

        when(songsRepository.findById("current-v")).thenReturn(Optional.of(current));
        when(songsRepository.findRelatedVideos(eq("current-v"), eq("Arijit Singh"), eq("Romantic"), eq(10)))
                .thenReturn(List.of(related));

        List<SongDto> result = videosApiService.getRelatedVideos("current-v", 10);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).id()).isEqualTo("related-v");
        assertThat(result.get(0).title()).isEqualTo("Related Video");
    }

    @Test
    @DisplayName("getVideosByArtist should return artist videos")
    void getVideosByArtist() {
        Song song = Song.builder()
                .id("v-artist")
                .title("Artist Track")
                .artistName("Taylor Swift")
                .fullVideoKey("videos/taylor.m3u8")
                .build();

        when(songsRepository.findVideosByArtist(eq("Taylor Swift"), any(PageRequest.class)))
                .thenReturn(List.of(song));
        when(songsRepository.countVideosByArtist(eq("Taylor Swift"))).thenReturn(1L);

        PaginatedResponseDto<SongDto> result = videosApiService.getVideosByArtist("Taylor Swift", 0, 10);

        assertThat(result.content()).hasSize(1);
        assertThat(result.content().get(0).title()).isEqualTo("Artist Track");
        assertThat(result.paginationMetaData().totalCount()).isEqualTo(1L);
    }
}

