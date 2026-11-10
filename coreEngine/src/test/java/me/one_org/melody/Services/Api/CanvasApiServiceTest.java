package me.one_org.melody.Services.Api;

import java.util.List;

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
import me.one_org.melody.Repository.UserShortsLikeRepository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CanvasApiServiceTest {

    @Mock
    private SongsRepository songsRepository;

    @Mock
    private UserShortsLikeRepository shortsLikeRepository;

    @InjectMocks
    private CanvasApiService canvasApiService;

    @Test
    @DisplayName("getCanvasFeed should return paginated canvas songs")
    void getCanvasFeed() {
        Song song = Song.builder()
                .id("c-1")
                .title("Canvas Song")
                .videoKey("canvas/c1.mp4")
                .genre("Pop")
                .build();

        when(songsRepository.findCanvasSongsLatest(eq("Pop"), any(PageRequest.class)))
                .thenReturn(List.of(song));
        when(songsRepository.countCanvasSongs(eq("Pop"))).thenReturn(1L);

        PaginatedResponseDto<SongDto> result = canvasApiService.getCanvasFeed(0, 10, "Pop", "latest");

        assertThat(result.content()).hasSize(1);
        assertThat(result.content().get(0).videoKey()).isEqualTo("canvas/c1.mp4");
        assertThat(result.paginationMetaData().totalCount()).isEqualTo(1L);
    }

    @Test
    @DisplayName("getFeaturedCanvas should return top canvas tracks")
    void getFeaturedCanvas() {
        Song song = Song.builder()
                .id("c-featured")
                .title("Featured Canvas")
                .videoKey("canvas/feat.mp4")
                .build();

        when(songsRepository.findCanvasSongsPopular(isNull(), any(PageRequest.class)))
                .thenReturn(List.of(song));

        List<SongDto> result = canvasApiService.getFeaturedCanvas(10);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).title()).isEqualTo("Featured Canvas");
    }
}

