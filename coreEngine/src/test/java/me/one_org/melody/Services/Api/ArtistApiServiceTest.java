package me.one_org.melody.Services.Api;

import java.util.Optional;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import me.one_org.melody.AlgoliaSearch.AlgoliaSearch;
import me.one_org.melody.Dto.Controllers.Api.ArtistFollowStatusDto;
import me.one_org.melody.Entity.Artist;
import me.one_org.melody.Entity.PaginationMetaData;
import me.one_org.melody.Entity.User;
import me.one_org.melody.Exceptions.ResourceNotFoundException;
import me.one_org.melody.Repository.ArtistFollowEventRepository;
import me.one_org.melody.Repository.ArtistMetadataRepository;
import me.one_org.melody.Repository.ArtistsRepository;
import me.one_org.melody.Repository.SongsRepository;
import me.one_org.melody.Repository.UsersRepository;
import me.one_org.melody.Services.General.PaginationMetaDataService;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ArtistApiServiceTest {

    @Mock
    private ArtistsRepository artistsRepository;
    @Mock
    private SongsRepository songsRepository;
    @Mock
    private UsersRepository usersRepository;
    @Mock
    private AlgoliaSearch algoliaSearch;
    @Mock
    private PaginationMetaDataService paginationMetaDataService;
    @Mock
    private ArtistMetadataRepository artistMetadataRepository;
    @Mock
    private ArtistFollowEventRepository artistFollowEventRepository;
    @Mock
    private ApplicationEventPublisher eventPublisher;

    @InjectMocks
    private ArtistApiService artistApiService;

    @Test
    @DisplayName("getArtistsPaginated should return empty list on out-of-bounds or zero count")
    void getArtistsPaginatedOutOfBounds() {
        when(paginationMetaDataService.getMetaData("ArtistsEntity")).thenReturn(null);
        when(artistsRepository.findAllPaginated(0, 10)).thenReturn(java.util.List.of());
        assertThat(artistApiService.getArtistsPaginated(0, 10)).isEmpty();

        PaginationMetaData meta = PaginationMetaData.builder().totalCount(5L).build();
        when(paginationMetaDataService.getMetaData("ArtistsEntity")).thenReturn(meta);
        assertThat(artistApiService.getArtistsPaginated(1, 10)).isEmpty();
    }

    @Test
    @DisplayName("getArtistById should return artist or throw ResourceNotFoundException")
    void getArtistById() {
        Artist artist = Artist.builder().id("art-1").name("Queen").build();
        when(artistsRepository.findById("art-1")).thenReturn(Optional.of(artist));
        when(artistsRepository.findById("art-none")).thenReturn(Optional.empty());

        assertThat(artistApiService.getArtistById("art-1").name()).isEqualTo("Queen");
        assertThatThrownBy(() -> artistApiService.getArtistById("art-none"))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("Artist not found with id: art-none");
    }

    @Test
    @DisplayName("followArtist should increment followers, persist event, and publish telemetry")
    void followArtist() {
        Artist artist = Artist.builder().id("art-2").name("Beatles").build();
        User user = User.builder().id("u-1").build();

        when(artistsRepository.findById("art-2")).thenReturn(Optional.of(artist));
        when(artistFollowEventRepository.isUserFollowingArtist("u-1", "art-2")).thenReturn(false);
        when(usersRepository.getReferenceById("u-1")).thenReturn(user);
        when(artistMetadataRepository.findFollowersCountById("art-2")).thenReturn(Optional.of(100L));

        ArtistFollowStatusDto status = artistApiService.followArtist("u-1", "art-2");

        assertThat(status.isFollowing()).isTrue();
        assertThat(status.followersCount()).isEqualTo(100L);
        verify(artistFollowEventRepository).save(any());
        verify(artistMetadataRepository).incrementFollowers("art-2", "Beatles");
        verify(eventPublisher).publishEvent(any(Object.class));
    }

    @Test
    @DisplayName("unfollowArtist should decrement followers, persist event, and publish telemetry")
    void unfollowArtist() {
        Artist artist = Artist.builder().id("art-3").name("Pink Floyd").build();
        User user = User.builder().id("u-1").build();

        when(artistsRepository.findById("art-3")).thenReturn(Optional.of(artist));
        when(artistFollowEventRepository.isUserFollowingArtist("u-1", "art-3")).thenReturn(true);
        when(usersRepository.getReferenceById("u-1")).thenReturn(user);
        when(artistMetadataRepository.findFollowersCountById("art-3")).thenReturn(Optional.of(99L));

        ArtistFollowStatusDto status = artistApiService.unfollowArtist("u-1", "art-3");

        assertThat(status.isFollowing()).isFalse();
        assertThat(status.followersCount()).isEqualTo(99L);
        verify(artistFollowEventRepository).save(any());
        verify(artistMetadataRepository).decrementFollowers("art-3");
        verify(eventPublisher).publishEvent(any(Object.class));
    }
}
