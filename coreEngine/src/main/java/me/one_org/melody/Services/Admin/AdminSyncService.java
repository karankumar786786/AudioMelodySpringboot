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

@Service
@Slf4j
public class AdminSyncService {

    private final SongsRepository songsRepository;
    private final ArtistsRepository artistsRepository;
    private final PlaylistsRepository playlistsRepository;
    private final AlgoliaSearch algoliaSearch;
    private final Recombee recombee;

    public AdminSyncService(SongsRepository songsRepository, ArtistsRepository artistsRepository,
                            PlaylistsRepository playlistsRepository, AlgoliaSearch algoliaSearch,
                            Recombee recombee) {
        this.songsRepository = songsRepository;
        this.artistsRepository = artistsRepository;
        this.playlistsRepository = playlistsRepository;
        this.algoliaSearch = algoliaSearch;
        this.recombee = recombee;
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

    public void resyncAll() {
        resyncAlgolia();
        resyncRecombee();
    }
}
