package me.one_org.melody.Services.Admin;

import java.util.List;

import org.springframework.stereotype.Service;

import lombok.extern.slf4j.Slf4j;
import me.one_org.melody.AlgoliaSearch.AlgoliaSearch;
import me.one_org.melody.Entity.ArtistsEntity;
import me.one_org.melody.Entity.PlaylistsEntity;
import me.one_org.melody.Entity.SongsEntity;
import me.one_org.melody.Recommendation.Recombee;
import me.one_org.melody.Repository.ArtistsRepository;
import me.one_org.melody.Repository.PlaylistsRepository;
import me.one_org.melody.Repository.SongsRepository;

import me.one_org.melody.Enums.StatusEnum;
import me.one_org.melody.Services.Genral.PaginationMetaDataService;

@Service
@Slf4j
public class AdminSyncService {

    private final SongsRepository songsRepository;
    private final ArtistsRepository artistsRepository;
    private final PlaylistsRepository playlistsRepository;
    private final AlgoliaSearch algoliaSearch;
    private final Recombee recombee;
    private final PaginationMetaDataService paginationMetaDataService;

    public AdminSyncService(SongsRepository songsRepository, ArtistsRepository artistsRepository,
                            PlaylistsRepository playlistsRepository, AlgoliaSearch algoliaSearch,
                            Recombee recombee, PaginationMetaDataService paginationMetaDataService) {
        this.songsRepository = songsRepository;
        this.artistsRepository = artistsRepository;
        this.playlistsRepository = playlistsRepository;
        this.algoliaSearch = algoliaSearch;
        this.recombee = recombee;
        this.paginationMetaDataService = paginationMetaDataService;
    }

    public void resyncAlgolia() {
        try {
            algoliaSearch.clearIndex();

            List<SongsEntity> songs = songsRepository.findAll();
            List<ArtistsEntity> artists = artistsRepository.findAll();
            List<PlaylistsEntity> playlists = playlistsRepository.findAll();

            algoliaSearch.reindexAllSongs(songs);
            algoliaSearch.reindexAllArtists(artists);
            algoliaSearch.reindexAllPlaylists(playlists);

            log.info("Algolia resync completed: {} songs, {} artists, {} playlists",
                    songs.size(), artists.size(), playlists.size());
        } catch (Exception e) {
            log.error("Algolia resync failed", e);
            throw new RuntimeException("Algolia resync failed: " + e.getMessage(), e);
        }
    }

    public void resyncRecombee() {
        try {
            List<SongsEntity> songs = songsRepository.findAll();
            recombee.reindexAll(songs);
            log.info("Recombee resync completed: {} songs", songs.size());
        } catch (Exception e) {
            log.error("Recombee resync failed", e);
            throw new RuntimeException("Recombee resync failed: " + e.getMessage(), e);
        }
    }

    public void resyncPaginationMetaData() {
        List<SongsEntity> songs = songsRepository.findAll();
        long songsTotal = songs.size();
        long songsActive = songs.stream().filter(s -> s.getStatus() == null || s.getStatus() == StatusEnum.ACTIVE).count();
        long songsBlocked = songs.stream().filter(s -> s.getStatus() == StatusEnum.BLOCKED).count();
        long songsDeleted = songs.stream().filter(s -> s.getStatus() == StatusEnum.DELETED).count();

        List<ArtistsEntity> artists = artistsRepository.findAll();
        long artistsTotal = artists.size();
        long artistsActive = artists.stream().filter(a -> a.getStatus() == null || a.getStatus() == StatusEnum.ACTIVE).count();
        long artistsBlocked = artists.stream().filter(a -> a.getStatus() == StatusEnum.BLOCKED).count();
        long artistsDeleted = artists.stream().filter(a -> a.getStatus() == StatusEnum.DELETED).count();

        List<PlaylistsEntity> playlists = playlistsRepository.findAll();
        long playlistsTotal = playlists.size();
        long playlistsActive = playlists.stream().filter(p -> p.getStatus() == null || p.getStatus() == StatusEnum.ACTIVE).count();
        long playlistsBlocked = playlists.stream().filter(p -> p.getStatus() == StatusEnum.BLOCKED).count();
        long playlistsDeleted = playlists.stream().filter(p -> p.getStatus() == StatusEnum.DELETED).count();

        paginationMetaDataService.updateCounts("SongsEntity", songsTotal, songsActive, songsBlocked, songsDeleted);
        paginationMetaDataService.updateCounts("ArtistsEntity", artistsTotal, artistsActive, artistsBlocked, artistsDeleted);
        paginationMetaDataService.updateCounts("PlaylistsEntity", playlistsTotal, playlistsActive, playlistsBlocked, playlistsDeleted);

        log.info("Pagination metadata resync completed: Songs={}, Artists={}, Playlists={}",
                songsTotal, artistsTotal, playlistsTotal);
    }

    public void resyncAll() {
        resyncAlgolia();
        resyncRecombee();
        resyncPaginationMetaData();
    }
}
