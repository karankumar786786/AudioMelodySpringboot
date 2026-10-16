package me.one_org.melody.Services.Api;


import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import me.one_org.melody.Dto.Controllers.Api.SaveSearchHistoryRequestDto;
import me.one_org.melody.Entity.PaginationMetaData;
import me.one_org.melody.Entity.Song;
import me.one_org.melody.Entity.User;
import me.one_org.melody.Entity.UserSearchHistory;
import me.one_org.melody.Repository.ArtistsRepository;
import me.one_org.melody.Repository.PlaylistsRepository;
import me.one_org.melody.Repository.SongsRepository;
import me.one_org.melody.Repository.UserHistoryRepository;
import me.one_org.melody.Repository.UserPlaylistsRepository;
import me.one_org.melody.Repository.UserSearchHistoryRepository;
import me.one_org.melody.Repository.UsersRepository;
import me.one_org.melody.Services.General.PaginationMetaDataService;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserHistoryApiServiceTest {

    @Mock
    private UserHistoryRepository userHistoryRepository;
    @Mock
    private UsersRepository usersRepository;
    @Mock
    private PaginationMetaDataService paginationMetaDataService;
    @Mock
    private UserSearchHistoryRepository searchHistoryRepository;
    @Mock
    private SongsRepository songsRepository;
    @Mock
    private ArtistsRepository artistsRepository;
    @Mock
    private PlaylistsRepository playlistsRepository;
    @Mock
    private UserPlaylistsRepository userPlaylistsRepository;

    @InjectMocks
    private UserHistoryApiService userHistoryApiService;

    @Test
    @DisplayName("getHistory should return empty list on out-of-bounds or zero count")
    void getHistoryOutOfBounds() {
        when(paginationMetaDataService.getMetaData("UserHistory_u-1")).thenReturn(null);
        assertThat(userHistoryApiService.getHistory("u-1", 0, 10)).isEmpty();

        PaginationMetaData meta = PaginationMetaData.builder().totalCount(5L).build();
        when(paginationMetaDataService.getMetaData("UserHistory_u-1")).thenReturn(meta);
        assertThat(userHistoryApiService.getHistory("u-1", 1, 10)).isEmpty();
    }

    @Test
    @DisplayName("saveSearchHistory should de-duplicate and save song search entry")
    void saveSearchHistoryForSong() {
        User user = User.builder().id("u-1").build();
        Song song = Song.builder().id("s-1").title("Song 1").build();
        when(usersRepository.getReferenceById("u-1")).thenReturn(user);
        when(songsRepository.existsById("s-1")).thenReturn(true);
        when(songsRepository.getReferenceById("s-1")).thenReturn(song);

        SaveSearchHistoryRequestDto request = new SaveSearchHistoryRequestDto("SONG", "s-1", null, null, null);
        userHistoryApiService.saveSearchHistory("u-1", request);

        verify(searchHistoryRepository).deleteByUserAndItem(user, "SONG", "s-1");
        verify(searchHistoryRepository).save(any(UserSearchHistory.class));
    }

    @Test
    @DisplayName("deleteSearchHistoryItem and clearSearchHistory should invoke repository delete methods")
    void deleteAndClearSearchHistory() {
        User user = User.builder().id("u-1").build();
        when(usersRepository.getReferenceById("u-1")).thenReturn(user);

        userHistoryApiService.deleteSearchHistoryItem("u-1", "item-9");
        verify(searchHistoryRepository).deleteByIdAndUser("item-9", user);

        userHistoryApiService.clearSearchHistory("u-1");
        verify(searchHistoryRepository).deleteByUser(user);
    }
}
