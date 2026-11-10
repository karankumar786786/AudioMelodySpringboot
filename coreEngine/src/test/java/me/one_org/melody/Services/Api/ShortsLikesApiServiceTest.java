package me.one_org.melody.Services.Api;

import java.util.Optional;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import me.one_org.melody.Dto.Controllers.Api.ShortsLikeStatusDto;
import me.one_org.melody.Entity.Song;
import me.one_org.melody.Entity.User;
import me.one_org.melody.Entity.UserShortsLike;
import me.one_org.melody.Repository.SongsRepository;
import me.one_org.melody.Repository.UserShortsLikeRepository;
import me.one_org.melody.Repository.UsersRepository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ShortsLikesApiServiceTest {
    @Mock
    private UserShortsLikeRepository shortsLikeRepository;
    @Mock
    private SongsRepository songsRepository;
    @Mock
    private UsersRepository usersRepository;
    @InjectMocks
    private ShortsLikesApiService shortsLikesApiService;
    @Test
    @DisplayName("toggleLike should add like if not already liked")
    void toggleLike_Add() {
        Song song = Song.builder().id("song-101").title("Short Song").build();
        User user = User.builder().id("user-1").userName("testuser").build();
        when(songsRepository.findById("song-101")).thenReturn(Optional.of(song));
        when(usersRepository.findById("user-1")).thenReturn(Optional.of(user));
        when(shortsLikeRepository.existsByUserIdAndSongId("user-1", "song-101")).thenReturn(false);
        when(shortsLikeRepository.countBySongId("song-101")).thenReturn(1L);

        ShortsLikeStatusDto result = shortsLikesApiService.toggleLike("user-1", "song-101");

        assertThat(result.isLiked()).isTrue();
        assertThat(result.count()).isEqualTo(1L);
        verify(shortsLikeRepository).save(any(UserShortsLike.class));
    }
    @Test
    @DisplayName("toggleLike should remove like if already liked")
    void toggleLike_Remove() {
        Song song = Song.builder().id("song-101").title("Short Song").build();
        when(songsRepository.findById("song-101")).thenReturn(Optional.of(song));
        when(shortsLikeRepository.existsByUserIdAndSongId("user-1", "song-101")).thenReturn(true);
        when(shortsLikeRepository.countBySongId("song-101")).thenReturn(0L);

        ShortsLikeStatusDto result = shortsLikesApiService.toggleLike("user-1", "song-101");

        assertThat(result.isLiked()).isFalse();
        assertThat(result.count()).isEqualTo(0L);
        verify(shortsLikeRepository).deleteByUserIdAndSongId("user-1", "song-101");
    }
    @Test
    @DisplayName("getLikeStatus should return liked state and total count")
    void getLikeStatus() {
        when(shortsLikeRepository.existsByUserIdAndSongId("user-1", "song-101")).thenReturn(true);
        when(shortsLikeRepository.countBySongId("song-101")).thenReturn(5L);

        ShortsLikeStatusDto result = shortsLikesApiService.getLikeStatus("user-1", "song-101");

        assertThat(result.isLiked()).isTrue();
        assertThat(result.count()).isEqualTo(5L);
    }
}