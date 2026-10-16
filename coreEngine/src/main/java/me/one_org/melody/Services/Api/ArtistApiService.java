package me.one_org.melody.Services.Api;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import lombok.extern.slf4j.Slf4j;
import me.one_org.melody.AlgoliaSearch.AlgoliaSearch;
import me.one_org.melody.Dto.Controllers.Api.ArtistDto;
import me.one_org.melody.Dto.Controllers.Api.ArtistFollowStatusDto;
import me.one_org.melody.Dto.Controllers.Api.PaginationMetaDataDto;
import me.one_org.melody.Dto.Controllers.Api.SongDto;
import me.one_org.melody.Entity.Artist;
import me.one_org.melody.Entity.ArtistFollowEvent;
import me.one_org.melody.Entity.PaginationMetaData;
import me.one_org.melody.Enums.FollowEvent;
import me.one_org.melody.Exceptions.BadRequestException;
import me.one_org.melody.Exceptions.ResourceNotFoundException;
import me.one_org.melody.Repository.ArtistFollowEventRepository;
import me.one_org.melody.Repository.ArtistMetadataRepository;
import me.one_org.melody.Repository.ArtistsRepository;
import org.springframework.context.ApplicationEventPublisher;
import me.one_org.melody.Events.TelemetryEvents;
import me.one_org.melody.Repository.SongsRepository;
import me.one_org.melody.Services.General.PaginationMetaDataService;

import me.one_org.melody.Repository.UsersRepository;

@Service
@Slf4j
@Transactional(readOnly = true)
public class ArtistApiService {

    private final ArtistsRepository artistsRepository;
    private final SongsRepository songsRepository;
    private final UsersRepository usersRepository;
    private final AlgoliaSearch algoliaSearch;
    private final PaginationMetaDataService paginationMetaDataService;
    private final ArtistMetadataRepository artistMetadataRepository;
    private final ArtistFollowEventRepository artistFollowEventRepository;
    private final ApplicationEventPublisher eventPublisher;

    public ArtistApiService(ArtistsRepository artistsRepository,
                            SongsRepository songsRepository,
                            UsersRepository usersRepository,
                            AlgoliaSearch algoliaSearch,
                            PaginationMetaDataService paginationMetaDataService,
                            ArtistMetadataRepository artistMetadataRepository,
                            ArtistFollowEventRepository artistFollowEventRepository,
                            ApplicationEventPublisher eventPublisher) {
        this.artistsRepository = artistsRepository;
        this.songsRepository = songsRepository;
        this.usersRepository = usersRepository;
        this.algoliaSearch = algoliaSearch;
        this.paginationMetaDataService = paginationMetaDataService;
        this.artistMetadataRepository = artistMetadataRepository;
        this.artistFollowEventRepository = artistFollowEventRepository;
        this.eventPublisher = eventPublisher;
    }

    public List<ArtistDto> getArtistsPaginated(int page, int size) {
        if (size <= 0 || page < 0) return List.of();

        PaginationMetaData meta = paginationMetaDataService.getMetaData("ArtistsEntity");
        if (meta != null && meta.getTotalCount() > 0 && (long) page * size >= meta.getTotalCount()) {
            return List.of();
        }

        return artistsRepository.findAllPaginated(page, size).stream()
                .map(ArtistDto::fromEntity)
                .toList();
    }

    public PaginationMetaDataDto getPaginationMetaData() {
        PaginationMetaData meta = paginationMetaDataService.getMetaData("ArtistsEntity");
        if (meta == null || meta.getTotalCount() == 0) {
            long count = artistsRepository.count();
            if (count > 0) {
                paginationMetaDataService.updateCounts("ArtistsEntity", count, count, 0L, 0L);
                meta = paginationMetaDataService.getMetaData("ArtistsEntity");
            }
        }
        return PaginationMetaDataDto.fromEntity(meta);
    }

    @Cacheable(value = "artist_lists", key = "'all'")
    public List<ArtistDto> getAllArtists() {
        return artistsRepository.findAllPaginated(0, 100).stream()
                .map(ArtistDto::fromEntity)
                .toList();
    }

    @Cacheable(value = "artists", key = "#id")
    public ArtistDto getArtistById(String id) {
        Artist artist = artistsRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Artist not found with id: " + id));
        return ArtistDto.fromEntity(artist);
    }

    @Cacheable(value = "artist_songs", key = "#artistIdOrQuery + '_' + #page + '_' + #size")
    public List<SongDto> getArtistSongsPaginated(String artistIdOrQuery, int page, int size) {
        if (artistIdOrQuery == null || artistIdOrQuery.isBlank()) {
            return List.of();
        }
        String searchQuery = artistIdOrQuery;
        Optional<Artist> artistOpt = artistsRepository.findById(artistIdOrQuery);
        if (artistOpt.isPresent()) {
            searchQuery = artistOpt.get().getName();
        }
        return songsRepository.findActiveByArtistName(searchQuery.trim(), org.springframework.data.domain.PageRequest.of(page, size)).stream()
                .map(SongDto::fromEntity)
                .toList();
    }

    public PaginationMetaDataDto getArtistSongsPaginationMetaData(String artistId) {
        String searchQuery = artistId;
        Optional<Artist> artistOpt = artistsRepository.findById(artistId);
        if (artistOpt.isPresent()) {
            searchQuery = artistOpt.get().getName();
        }
        long count = songsRepository.countActiveByArtistName(searchQuery.trim());
        return new PaginationMetaDataDto(
                "meta_artist_songs_" + artistId,
                "ArtistSongs_" + artistId,
                count,
                count,
                0L,
                0L,
                LocalDateTime.now()
        );
    }

    // ── Artist Follow & Metadata Operations ──

    public Optional<Artist> findArtist(String artistIdOrName) {
        if (artistIdOrName == null || artistIdOrName.isBlank()) {
            return Optional.empty();
        }
        // 1. Try finding by ID
        Optional<Artist> byId = artistsRepository.findById(artistIdOrName);
        if (byId.isPresent()) {
            return byId;
        }

        // 2. Try finding by Name (case-insensitive)
        return artistsRepository.findByNameIgnoreCase(artistIdOrName);
    }

    @Transactional
    public ArtistFollowStatusDto followArtist(String userId, String artistIdOrName) {
        if (userId == null || userId.isBlank()) {
            throw new ResourceNotFoundException("User must be authenticated to follow an artist");
        }
        Optional<Artist> artistOpt = findArtist(artistIdOrName);
        if (artistOpt.isEmpty()) {
            throw new ResourceNotFoundException("Artist not found with identifier: " + artistIdOrName);
        }
        Artist artist = artistOpt.get();
        String artistId = artist.getId();
        String artistName = artist.getName();

        boolean alreadyFollowing = artistFollowEventRepository.isUserFollowingArtist(userId, artistId);
        if (!alreadyFollowing) {
            ArtistFollowEvent event = ArtistFollowEvent.builder()
                    .id(UUID.randomUUID().toString())
                    .user(usersRepository.getReferenceById(userId))
                    .artist(artist)
                    .followEvent(FollowEvent.FOLLOW)
                    .build();
            artistFollowEventRepository.save(event);

            artistMetadataRepository.incrementFollowers(artistId, artistName);

            eventPublisher.publishEvent(new TelemetryEvents.ArtistFollowEvent(userId, artistId));
        }

        Long followersCount = artistMetadataRepository.findFollowersCountById(artistId)
                .orElse(1L);

        return new ArtistFollowStatusDto(artistId, artistName, followersCount, true);
    }

    @Transactional
    public ArtistFollowStatusDto unfollowArtist(String userId, String artistIdOrName) {
        if (userId == null || userId.isBlank()) {
            throw new ResourceNotFoundException("User must be authenticated to unfollow an artist");
        }
        Optional<Artist> artistOpt = findArtist(artistIdOrName);
        if (artistOpt.isEmpty()) {
            throw new ResourceNotFoundException("Artist not found with identifier: " + artistIdOrName);
        }
        Artist artist = artistOpt.get();
        String artistId = artist.getId();
        String artistName = artist.getName();

        boolean wasFollowing = artistFollowEventRepository.isUserFollowingArtist(userId, artistId);
        if (wasFollowing) {
            ArtistFollowEvent event = ArtistFollowEvent.builder()
                    .id(UUID.randomUUID().toString())
                    .user(usersRepository.getReferenceById(userId))
                    .artist(artist)
                    .followEvent(FollowEvent.UNFOLLOW)
                    .build();
            artistFollowEventRepository.save(event);

            artistMetadataRepository.decrementFollowers(artistId);

            eventPublisher.publishEvent(new TelemetryEvents.ArtistUnfollowEvent(userId, artistId));
        }

        Long followersCount = artistMetadataRepository.findFollowersCountById(artistId)
                .orElse(0L);

        return new ArtistFollowStatusDto(artistId, artistName, followersCount, false);
    }

    public ArtistFollowStatusDto getFollowStatus(String userId, String artistIdOrName) {
        Optional<Artist> artistOpt = findArtist(artistIdOrName);
        if (artistOpt.isEmpty()) {
            return new ArtistFollowStatusDto(artistIdOrName, artistIdOrName, 0L, false);
        }
        Artist artist = artistOpt.get();
        String artistId = artist.getId();
        String artistName = artist.getName();

        boolean isFollowing = userId != null && artistFollowEventRepository.isUserFollowingArtist(userId, artistId);
        Long followersCount = artistMetadataRepository.findFollowersCountById(artistId)
                .orElse(0L);

        return new ArtistFollowStatusDto(artistId, artistName, followersCount, isFollowing);
    }

    // ── Cold-Start Artist Onboarding ──

    public List<ArtistDto> getOnboardingArtists() {
        return getOnboardingArtists(0, 100);
    }

    public List<ArtistDto> getOnboardingArtists(int page, int size) {
        return artistsRepository.findAllPaginated(page, size).stream()
                .map(ArtistDto::fromEntity)
                .toList();
    }

    public List<ArtistDto> searchArtists(String query) {
        if (query == null || query.isBlank()) {
            return getOnboardingArtists();
        }
        String cleanQuery = query.trim().toLowerCase();
        Set<String> seenNames = new HashSet<>();
        List<Artist> results = new ArrayList<>();

        // 1. Search DB artists table by name
        List<Artist> fromArtists = artistsRepository.searchByName(cleanQuery, 20);
        for (Artist a : fromArtists) {
            if (a.getName() != null && seenNames.add(a.getName().trim().toLowerCase())) {
                results.add(a);
            }
        }

        // 2. Search Algolia for artists
        try {
            var algoliaRes = algoliaSearch.search(cleanQuery);
            List<String> algoliaArtistIds = algoliaRes.artists().stream().map(a -> a.id()).toList();
            if (!algoliaArtistIds.isEmpty()) {
                List<Artist> algoliaArtists = artistsRepository.findAllByIds(algoliaArtistIds);
                for (Artist a : algoliaArtists) {
                    if (a.getName() != null && seenNames.add(a.getName().trim().toLowerCase())) {
                        results.add(a);
                    }
                }
            }
        } catch (Exception ignored) {}

        return results.stream()
                .map(ArtistDto::fromEntity)
                .toList();
    }

    public Map<String, Object> completeOnboarding(String userId, List<String> artistIds) {
        if (userId == null || userId.isBlank()) {
            throw new ResourceNotFoundException("User must be authenticated to complete onboarding");
        }
        if (artistIds == null || artistIds.isEmpty()) {
            throw new BadRequestException("Please select artists for onboarding");
        }

        List<String> followedNames = new ArrayList<>();
        List<String> followedArtistIds = new ArrayList<>();
        List<String> skippedIds = new ArrayList<>();

        for (String idOrName : artistIds) {
            try {
                Artist artist = findArtist(idOrName)
                        .orElseThrow(() -> new ResourceNotFoundException("Artist not found: " + idOrName));

                ArtistFollowStatusDto status = followArtist(userId, artist.getId());
                followedNames.add(status.artistName());
                followedArtistIds.add(status.artistId());
            } catch (Exception e) {
                log.warn("Skipping artist [{}] during onboarding for user [{}]: {}", idOrName, userId, e.getMessage());
                skippedIds.add(idOrName);
            }
        }

        // Require at least one artist to have been successfully followed
        if (followedNames.isEmpty()) {
            throw new BadRequestException(
                "None of the selected artists could be found. Please search and select valid artists.");
        }

        // Decoupled telemetry: provision user and seed recommendation profile AFTER transaction commits
        eventPublisher.publishEvent(new TelemetryEvents.OnboardingSeededEvent(userId, followedArtistIds));

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("followedCount", followedNames.size());
        response.put("followedArtists", followedNames);
        response.put("skippedArtists", skippedIds);
        response.put("message", "Cold-start onboarding complete. Recommendation profile seeded.");
        return response;
    }
}
