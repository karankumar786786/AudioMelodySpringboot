package me.one_org.melody.Services.Api;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import me.one_org.melody.AlgoliaSearch.AlgoliaSearch;
import me.one_org.melody.Dto.AlgoliaSearch.AlgoliaSearchResult;
import me.one_org.melody.Dto.AlgoliaSearch.SearchResult;
import me.one_org.melody.Dto.Controllers.Api.ArtistDto;
import me.one_org.melody.Dto.Controllers.Api.PlaylistDto;
import me.one_org.melody.Dto.Controllers.Api.SongDto;
import me.one_org.melody.Dto.Controllers.Api.UserPlaylistDto;
import me.one_org.melody.Entity.Artist;
import me.one_org.melody.Entity.Playlist;
import me.one_org.melody.Entity.Song;
import me.one_org.melody.Entity.UserPlaylist;
import me.one_org.melody.Repository.ArtistsRepository;
import me.one_org.melody.Repository.PlaylistsRepository;
import me.one_org.melody.Repository.SongsRepository;
import me.one_org.melody.Repository.UserPlaylistsRepository;

@Service
@Transactional(readOnly = true)
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
        // 1. Search Algolia — Algolia ranks candidates by relevance & customRanking desc(totalStreams)
        AlgoliaSearchResult algoliaResult = algoliaSearch.search(query);

        // 2. Extract IDs in Algolia's ranked order
        List<String> songIds = algoliaResult.songs().stream()
                .map(s -> s.id()).collect(Collectors.toList());
        List<String> artistIds = algoliaResult.artists().stream()
                .map(a -> a.id()).collect(Collectors.toList());
        List<String> playlistIds = algoliaResult.playlists().stream()
                .map(p -> p.id()).collect(Collectors.toList());

        // 3. Fetch full entities from DB
        List<Song> rawSongs = songsRepository.findAllByIds(songIds);
        List<Artist> rawArtists = artistsRepository.findAllByIds(artistIds);
        List<Playlist> rawPlaylists = playlistsRepository.findAllByIds(playlistIds);
        List<UserPlaylist> rawUserPlaylists = userPlaylistsRepository.findAllPublicByIds(playlistIds);

        // 4. Preserve Algolia's exact ranking order and convert to DTOs
        Map<String, Song> songMap = rawSongs.stream().collect(Collectors.toMap(Song::getId, s -> s));
        List<SongDto> songs = new ArrayList<>();
        for (String id : songIds) {
            Song s = songMap.get(id);
            if (s != null) songs.add(SongDto.fromEntity(s));
        }

        Map<String, Artist> artistMap = rawArtists.stream().collect(Collectors.toMap(Artist::getId, a -> a));
        List<ArtistDto> artists = new ArrayList<>();
        for (String id : artistIds) {
            Artist a = artistMap.get(id);
            if (a != null) artists.add(ArtistDto.fromEntity(a));
        }

        Map<String, Playlist> playlistMap = rawPlaylists.stream().collect(Collectors.toMap(Playlist::getId, p -> p));
        List<PlaylistDto> playlists = new ArrayList<>();
        for (String id : playlistIds) {
            Playlist p = playlistMap.get(id);
            if (p != null) playlists.add(PlaylistDto.fromEntity(p));
        }

        Map<String, UserPlaylist> userPlaylistMap = rawUserPlaylists.stream().collect(Collectors.toMap(UserPlaylist::getId, up -> up));
        List<UserPlaylistDto> userPlaylists = new ArrayList<>();
        for (String id : playlistIds) {
            UserPlaylist up = userPlaylistMap.get(id);
            if (up != null) userPlaylists.add(UserPlaylistDto.fromEntity(up));
        }

        return new SearchResult(songs, artists, playlists, userPlaylists);
    }

    public me.one_org.melody.Dto.AlgoliaSearch.AlgoliaClientConfigDto getFrontendSearchConfig() {
        return algoliaSearch.getClientSearchConfig();
    }
}
