package me.one_org.melody.Services.Api;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import me.one_org.melody.AlgoliaSearch.AlgoliaSearch;
import me.one_org.melody.Dto.AlgoliaSearch.SearchResult;

/**
 * Search: query Algolia ko bhejo aur poora result lautao.
 *
 * Service = asli business logic. Controller isko call karta hai, ye repositories (DB), cache aur
 * bahar ki services (Recombee, Algolia) ko use karta hai.
 * @Transactional(readOnly = true) = by default sirf padhne wale DB transactions (thode fast);
 * jo methods data badalte hain un pe alag se @Transactional laga hai.
 * @Cacheable = result Redis me cache hota hai (RedisConfig dekho).
 */
@Service
@Transactional(readOnly = true)
public class SearchApiService {

    private final AlgoliaSearch algoliaSearch;

    public SearchApiService(AlgoliaSearch algoliaSearch) {
        this.algoliaSearch = algoliaSearch;
    }

    /** Query se songs/artists/playlists dhoondo. */
    public SearchResult search(String query, String userId) {
        return algoliaSearch.searchDetailed(query);
    }
}
