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

/**
 * Artists ka logic: list, details, artist ke songs, follow/unfollow (followers count ke saath), onboarding.
 *
 * Service = asli business logic. Controller isko call karta hai, ye repositories (DB), cache aur
 * bahar ki services (Recombee, Algolia) ko use karta hai.
 * @Transactional(readOnly = true) = by default sirf padhne wale DB transactions (thode fast);
 * jo methods data badalte hain un pe alag se @Transactional laga hai.
 * @Cacheable = result Redis me cache hota hai (RedisConfig dekho).
 */
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

    /** Artists page by page. Page total se bahar ho to khaali list. */
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

    /** Artists ke counts (pagination ke liye). */
    public PaginationMetaDataDto getPaginationMetaData() {
        PaginationMetaData meta = paginationMetaDataService.getMetaData("ArtistsEntity");
        return PaginationMetaDataDto.fromEntity(meta);
    }

    /** Saare artists (Redis cache me). */
    @Cacheable(value = "artist_lists", key = "'all'")
    public List<ArtistDto> getAllArtists() {
        return artistsRepository.findAllPaginated(0, 100).stream()
                .map(ArtistDto::fromEntity)
                .toList();
    }

    /** Id se artist (cache me). Na mile to 404. */
    @Cacheable(value = "artists", key = "#id")
    public ArtistDto getArtistById(String id) {
        Artist artist = artistsRepository.findById(id)
                .or(() -> artistsRepository.findByNameIgnoreCase(id))
                .orElseThrow(() -> new ResourceNotFoundException("Artist not found with id: " + id));
        return ArtistDto.fromEntity(artist);
    }

    /** Artist ke songs. Input id ho ya naam - dono chalte hain (cache me). */
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

    /** Artist ke kitne songs hain. */
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

    // ── Artist follow / unfollow ──

    /** Id ya naam se artist dhoondo. */
    public Optional<Artist> findArtist(String artistIdOrName) {
        if (artistIdOrName == null || artistIdOrName.isBlank()) {
            return Optional.empty();
        }
        // 1. Pehle id se dhoondo
        Optional<Artist> byId = artistsRepository.findById(artistIdOrName);
        if (byId.isPresent()) {
            return byId;
        }

        // 2. Na mile to naam se (chhote-bade akshar ignore)
        return artistsRepository.findByNameIgnoreCase(artistIdOrName);
    }

    /**
     * Follow karo: follow event row likho, followers +1, Recombee/Kafka ke liye event bhejo.
     * Pehle se follow hai to kuch nahi badalta.
     */
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

    /** Unfollow karo: UNFOLLOW row, followers -1, event bhejo. Follow hi nahi tha to kuch nahi. */
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

    /** Kya user follow karta hai + followers count. */
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

    // ── Naye user ki onboarding (artists chunna) ──

    /** Onboarding screen ke artists (default page). */
    public List<ArtistDto> getOnboardingArtists() {
        return getOnboardingArtists(0, 100);
    }

    /** Onboarding ke artists, page by page. */
    public List<ArtistDto> getOnboardingArtists(int page, int size) {
        return artistsRepository.findAllPaginated(page, size).stream()
                .map(ArtistDto::fromEntity)
                .toList();
    }

    /** Artists search: pehle DB, phir Algolia - dono ke results bina duplicate ke. */
    public List<ArtistDto> searchArtists(String query) {
        if (query == null || query.isBlank()) {
            return getOnboardingArtists();
        }
        String cleanQuery = query.trim().toLowerCase();
        Set<String> seenNames = new HashSet<>();
        List<Artist> results = new ArrayList<>();

        // 1. Database ki artists table me naam se dhoondo
        List<Artist> fromArtists = artistsRepository.searchByName(cleanQuery, 20);
        for (Artist a : fromArtists) {
            if (a.getName() != null && seenNames.add(a.getName().trim().toLowerCase())) {
                results.add(a);
            }
        }

        // 2. Phir Algolia me artists dhoondo
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

    /**
     * Onboarding khatam: chune artists follow karo, aur commit ke baad Recombee seed karne ka event bhejo.
     * Ek bhi artist follow na ho paaye to 400.
     */
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

        // Kam se kam ek artist follow hona chahiye
        if (followedNames.isEmpty()) {
            throw new BadRequestException(
                "None of the selected artists could be found. Please search and select valid artists.");
        }

        // Recombee me user banana aur seed karna commit ke BAAD hoga (event se), taaki request slow na ho
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
