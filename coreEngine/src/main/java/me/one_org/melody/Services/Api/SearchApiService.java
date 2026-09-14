package me.one_org.melody.Services.Api;

import java.util.List;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;

import me.one_org.melody.AlgoliaSearch.AlgoliaSearch;
import me.one_org.melody.Dto.AlgoliaSearch.AlgoliaSearchResult;
import me.one_org.melody.Dto.AlgoliaSearch.SearchResult;
import me.one_org.melody.Entity.ArtistsEntity;
import me.one_org.melody.Entity.PlaylistsEntity;
import me.one_org.melody.Entity.SongsEntity;
import me.one_org.melody.Entity.UserPlaylistsEntity;
import me.one_org.melody.Repository.ArtistsRepository;
import me.one_org.melody.Repository.PlaylistsRepository;
import me.one_org.melody.Repository.SongsRepository;
import me.one_org.melody.Repository.UserPlaylistsRepository;

@Service
public class SearchApiService {

    private final AlgoliaSearch algoliaSearch;
    private final SongsRepository songsRepository;
    private final ArtistsRepository artistsRepository;
    private final PlaylistsRepository playlistsRepository;
    private final UserPlaylistsRepository userPlaylistsRepository;

    public SearchApiService(AlgoliaSearch algoliaSearch, SongsRepository songsRepository,
                            ArtistsRepository artistsRepository, PlaylistsRepository playlistsRepository,
                            UserPlaylistsRepository userPlaylistsRepository) {
        this.algoliaSearch = algoliaSearch;
        this.songsRepository = songsRepository;
        this.artistsRepository = artistsRepository;
        this.playlistsRepository = playlistsRepository;
        this.userPlaylistsRepository = userPlaylistsRepository;
    }

    public SearchResult search(String query, String userId) {
        // 1. Search Algolia — returns IDs only
        AlgoliaSearchResult algoliaResult = algoliaSearch.search(query);

        // 2. Fetch full data from DB
        List<String> songIds = algoliaResult.songs().stream()
                .map(s -> s.id()).collect(Collectors.toList());
        List<String> artistIds = algoliaResult.artists().stream()
                .map(a -> a.id()).collect(Collectors.toList());
        List<String> playlistIds = algoliaResult.playlists().stream()
                .map(p -> p.id()).collect(Collectors.toList());

        List<SongsEntity> songs = songsRepository.findAllByIds(songIds);
        List<ArtistsEntity> artists = artistsRepository.findAllByIds(artistIds);
        List<PlaylistsEntity> playlists = playlistsRepository.findAllByIds(playlistIds);
        List<UserPlaylistsEntity> userPlaylists = userPlaylistsRepository.findAllPublicByIds(playlistIds);

        return new SearchResult(songs, artists, playlists, userPlaylists);
    }
}
