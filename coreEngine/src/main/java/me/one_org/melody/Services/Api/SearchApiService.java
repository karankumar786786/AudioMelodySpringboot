package me.one_org.melody.Services.Api;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
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
        // 1. Search Algolia — Algolia ranks candidates by relevance & customRanking desc(searchCount)
        AlgoliaSearchResult algoliaResult = algoliaSearch.search(query);

        // 2. Extract IDs in Algolia's ranked order
        List<String> songIds = algoliaResult.songs().stream()
                .map(s -> s.id()).collect(Collectors.toList());
        List<String> artistIds = algoliaResult.artists().stream()
                .map(a -> a.id()).collect(Collectors.toList());
        List<String> playlistIds = algoliaResult.playlists().stream()
                .map(p -> p.id()).collect(Collectors.toList());

        // 3. Fetch full entities from DB
        List<SongsEntity> rawSongs = songsRepository.findAllByIds(songIds);
        List<ArtistsEntity> rawArtists = artistsRepository.findAllByIds(artistIds);
        List<PlaylistsEntity> rawPlaylists = playlistsRepository.findAllByIds(playlistIds);
        List<UserPlaylistsEntity> rawUserPlaylists = userPlaylistsRepository.findAllPublicByIds(playlistIds);

        // 4. Preserve Algolia's exact ranking order
        Map<String, SongsEntity> songMap = rawSongs.stream().collect(Collectors.toMap(SongsEntity::getId, s -> s));
        List<SongsEntity> songs = new ArrayList<>();
        for (String id : songIds) {
            SongsEntity s = songMap.get(id);
            if (s != null) songs.add(s);
        }

        Map<String, ArtistsEntity> artistMap = rawArtists.stream().collect(Collectors.toMap(ArtistsEntity::getId, a -> a));
        List<ArtistsEntity> artists = new ArrayList<>();
        for (String id : artistIds) {
            ArtistsEntity a = artistMap.get(id);
            if (a != null) artists.add(a);
        }

        Map<String, PlaylistsEntity> playlistMap = rawPlaylists.stream().collect(Collectors.toMap(PlaylistsEntity::getId, p -> p));
        List<PlaylistsEntity> playlists = new ArrayList<>();
        for (String id : playlistIds) {
            PlaylistsEntity p = playlistMap.get(id);
            if (p != null) playlists.add(p);
        }

        Map<String, UserPlaylistsEntity> userPlaylistMap = rawUserPlaylists.stream().collect(Collectors.toMap(UserPlaylistsEntity::getId, up -> up));
        List<UserPlaylistsEntity> userPlaylists = new ArrayList<>();
        for (String id : playlistIds) {
            UserPlaylistsEntity up = userPlaylistMap.get(id);
            if (up != null) userPlaylists.add(up);
        }

        return new SearchResult(songs, artists, playlists, userPlaylists);
    }
}
