package me.one_org.melody.Services.Api;

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
import me.one_org.melody.Dto.Controllers.Api.ArtistFollowStatusDto;
import me.one_org.melody.Entity.ArtistFollowEventEntity;
import me.one_org.melody.Entity.ArtistMetadataEntity;
import me.one_org.melody.Entity.ArtistsEntity;
import me.one_org.melody.Entity.PaginationMetaDataEntity;
import me.one_org.melody.Entity.SongsEntity;
import me.one_org.melody.Exceptions.BadRequestException;
import me.one_org.melody.Exceptions.ResourceNotFoundException;
import me.one_org.melody.Recommendation.Recombee;
import me.one_org.melody.Repository.ArtistFollowEventRepository;
import me.one_org.melody.Repository.ArtistMetadataRepository;
import me.one_org.melody.Repository.ArtistsRepository;
import me.one_org.melody.Repository.SongsRepository;
import me.one_org.melody.Services.General.PaginationMetaDataService;

@Service
@Slf4j
public class ArtistApiService {

    private final ArtistsRepository artistsRepository;
    private final SongsRepository songsRepository;
    private final AlgoliaSearch algoliaSearch;
    private final PaginationMetaDataService paginationMetaDataService;
    private final ArtistMetadataRepository artistMetadataRepository;
    private final ArtistFollowEventRepository artistFollowEventRepository;
    private final Recombee recombee;

    public ArtistApiService(ArtistsRepository artistsRepository,
                            SongsRepository songsRepository,
                            AlgoliaSearch algoliaSearch,
                            PaginationMetaDataService paginationMetaDataService,
                            ArtistMetadataRepository artistMetadataRepository,
                            ArtistFollowEventRepository artistFollowEventRepository,
                            Recombee recombee) {
        this.artistsRepository = artistsRepository;
        this.songsRepository = songsRepository;
        this.algoliaSearch = algoliaSearch;
        this.paginationMetaDataService = paginationMetaDataService;
        this.artistMetadataRepository = artistMetadataRepository;
        this.artistFollowEventRepository = artistFollowEventRepository;
        this.recombee = recombee;
    }

    public List<ArtistsEntity> getArtistsPaginated(int page, int size) {
        return artistsRepository.findAllPaginated(page, size);
    }

    public PaginationMetaDataEntity getPaginationMetaData() {
        return paginationMetaDataService.getMetaData("ArtistsEntity");
    }

    @Cacheable(value = "artist_lists", key = "'all'")
    public List<ArtistsEntity> getAllArtists() {
        return artistsRepository.findAll();
    }

    @Cacheable(value = "artists", key = "#id")
    public ArtistsEntity getArtistById(String id) {
        return artistsRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Artist not found with id: " + id));
    }

    @Cacheable(value = "artist_songs", key = "#artistIdOrQuery + '_' + #page + '_' + #size")
    public List<SongsEntity> getArtistSongsPaginated(String artistIdOrQuery, int page, int size) {
        if (artistIdOrQuery == null || artistIdOrQuery.isBlank()) {
            return List.of();
        }
        String searchQuery = artistIdOrQuery;
        Optional<ArtistsEntity> artistOpt = artistsRepository.findById(artistIdOrQuery);
        if (artistOpt.isPresent()) {
            searchQuery = artistOpt.get().getName();
        }
        List<String> songIds = algoliaSearch.searchSongsByArtist(searchQuery);
        if (songIds.isEmpty()) {
            return List.of();
        }
        int fromIndex = Math.min(page * size, songIds.size());
        int toIndex = Math.min(fromIndex + size, songIds.size());
        List<String> pageIds = songIds.subList(fromIndex, toIndex);
        return songsRepository.findAllByIds(pageIds);
    }

    public PaginationMetaDataEntity getArtistSongsPaginationMetaData(String artistId) {
        return paginationMetaDataService.getMetaData("ArtistSongs_" + artistId);
    }

    // ── Artist Follow & Metadata Operations ──

    public Optional<ArtistsEntity> findArtist(String artistIdOrName) {
        if (artistIdOrName == null || artistIdOrName.isBlank()) {
            return Optional.empty();
        }
        // 1. Try finding by ID
        Optional<ArtistsEntity> byId = artistsRepository.findById(artistIdOrName);
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
        Optional<ArtistsEntity> artistOpt = findArtist(artistIdOrName);
        if (artistOpt.isEmpty()) {
            throw new ResourceNotFoundException("Artist not found with identifier: " + artistIdOrName);
        }
        ArtistsEntity artist = artistOpt.get();
        String artistId = artist.getId();
        String artistName = artist.getName();

        boolean alreadyFollowing = artistFollowEventRepository.isUserFollowingArtist(userId, artistId);
        if (!alreadyFollowing) {
            ArtistFollowEventEntity event = ArtistFollowEventEntity.builder()
                    .id(UUID.randomUUID().toString())
                    .userId(userId)
                    .artistId(artistId)
                    .eventType("FOLLOW")
                    .build();
            artistFollowEventRepository.save(event);

            artistMetadataRepository.incrementFollowers(artistId, artistName);

            Thread.startVirtualThread(() -> {
                try {
                    recombee.trackArtistFollow(userId, artistId);
                    log.info("Tracked artist follow in Recombee for user [{}] artist [{}]", userId, artistId);
                } catch (Exception e) {
                    log.error("Failed to track artist follow in Recombee for user [{}] artist [{}]: {}", userId, artistId, e.getMessage());
                }
            });
        }

        Long followersCount = artistMetadataRepository.findById(artistId)
                .map(ArtistMetadataEntity::getFollowersCount)
                .orElse(1L);

        return new ArtistFollowStatusDto(artistId, artistName, followersCount, true);
    }

    @Transactional
    public ArtistFollowStatusDto unfollowArtist(String userId, String artistIdOrName) {
        if (userId == null || userId.isBlank()) {
            throw new ResourceNotFoundException("User must be authenticated to unfollow an artist");
        }
        Optional<ArtistsEntity> artistOpt = findArtist(artistIdOrName);
        if (artistOpt.isEmpty()) {
            throw new ResourceNotFoundException("Artist not found with identifier: " + artistIdOrName);
        }
        ArtistsEntity artist = artistOpt.get();
        String artistId = artist.getId();
        String artistName = artist.getName();

        boolean wasFollowing = artistFollowEventRepository.isUserFollowingArtist(userId, artistId);
        if (wasFollowing) {
            ArtistFollowEventEntity event = ArtistFollowEventEntity.builder()
                    .id(UUID.randomUUID().toString())
                    .userId(userId)
                    .artistId(artistId)
                    .eventType("UNFOLLOW")
                    .build();
            artistFollowEventRepository.save(event);

            artistMetadataRepository.decrementFollowers(artistId);

            Thread.startVirtualThread(() -> {
                try {
                    recombee.trackArtistUnfollow(userId, artistId);
                    log.info("Tracked artist unfollow in Recombee for user [{}] artist [{}]", userId, artistId);
                } catch (Exception e) {
                    log.error("Failed to track artist unfollow in Recombee for user [{}] artist [{}]: {}", userId, artistId, e.getMessage());
                }
            });
        }

        Long followersCount = artistMetadataRepository.findById(artistId)
                .map(ArtistMetadataEntity::getFollowersCount)
                .orElse(0L);

        return new ArtistFollowStatusDto(artistId, artistName, followersCount, false);
    }

    public ArtistFollowStatusDto getFollowStatus(String userId, String artistIdOrName) {
        Optional<ArtistsEntity> artistOpt = findArtist(artistIdOrName);
        if (artistOpt.isEmpty()) {
            return new ArtistFollowStatusDto(artistIdOrName, artistIdOrName, 0L, false);
        }
        ArtistsEntity artist = artistOpt.get();
        String artistId = artist.getId();
        String artistName = artist.getName();

        boolean isFollowing = userId != null && artistFollowEventRepository.isUserFollowingArtist(userId, artistId);
        Long followersCount = artistMetadataRepository.findById(artistId)
                .map(ArtistMetadataEntity::getFollowersCount)
                .orElse(0L);

        return new ArtistFollowStatusDto(artistId, artistName, followersCount, isFollowing);
    }

    // ── Cold-Start Artist Onboarding ──

    public List<ArtistsEntity> getOnboardingArtists() {
        return getOnboardingArtists(0, 100);
    }

    public List<ArtistsEntity> getOnboardingArtists(int page, int size) {
        return artistsRepository.findAllPaginated(page, size);
    }

    public List<ArtistsEntity> searchArtists(String query) {
        if (query == null || query.isBlank()) {
            return getOnboardingArtists();
        }
        String cleanQuery = query.trim().toLowerCase();
        Set<String> seenNames = new HashSet<>();
        List<ArtistsEntity> results = new ArrayList<>();

        // 1. Search DB artists table by name
        List<ArtistsEntity> fromArtists = artistsRepository.searchByName(cleanQuery, 20);
        for (ArtistsEntity a : fromArtists) {
            if (a.getName() != null && seenNames.add(a.getName().trim().toLowerCase())) {
                results.add(a);
            }
        }

        // 2. Search Algolia for artists
        try {
            var algoliaRes = algoliaSearch.search(cleanQuery);
            List<String> algoliaArtistIds = algoliaRes.artists().stream().map(a -> a.id()).toList();
            if (!algoliaArtistIds.isEmpty()) {
                List<ArtistsEntity> algoliaArtists = artistsRepository.findAllByIds(algoliaArtistIds);
                for (ArtistsEntity a : algoliaArtists) {
                    if (a.getName() != null && seenNames.add(a.getName().trim().toLowerCase())) {
                        results.add(a);
                    }
                }
            }
        } catch (Exception ignored) {}

        return results;
    }

    public Map<String, Object> completeOnboarding(String userId, List<String> artistIds) {
        if (userId == null || userId.isBlank()) {
            throw new ResourceNotFoundException("User must be authenticated to complete onboarding");
        }
        if (artistIds == null || artistIds.isEmpty()) {
            throw new BadRequestException("Please select artists for onboarding");
        }

        // Ensure user is provisioned in Recombee
        try {
            recombee.addUser(userId);
        } catch (Exception ignored) {}

        List<String> followedNames = new ArrayList<>();
        List<String> skippedIds = new ArrayList<>();

        for (String idOrName : artistIds) {
            try {
                ArtistsEntity artist = findArtist(idOrName)
                        .orElseThrow(() -> new ResourceNotFoundException("Artist not found: " + idOrName));

                ArtistFollowStatusDto status = followArtist(userId, artist.getId());
                followedNames.add(status.artistName());

                // Seed positive play interaction signals for artist's top songs in Recombee via virtual thread
                final String targetArtistId = status.artistId();
                Thread.startVirtualThread(() -> {
                    try {
                        List<SongsEntity> topSongs = getArtistSongsPaginated(targetArtistId, 0, 3);
                        for (SongsEntity song : topSongs) {
                            try {
                                recombee.trackPlay(userId, song.getId(), 0.95);
                            } catch (Exception ignored) {}
                        }
                    } catch (Exception ignored) {}
                });

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

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("followedCount", followedNames.size());
        response.put("followedArtists", followedNames);
        response.put("skippedArtists", skippedIds);
        response.put("message", "Cold-start onboarding complete. Recommendation profile seeded.");
        return response;
    }
}
