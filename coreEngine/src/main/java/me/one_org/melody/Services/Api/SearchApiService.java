package me.one_org.melody.Services.Api;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import me.one_org.melody.AlgoliaSearch.AlgoliaSearch;
import me.one_org.melody.Dto.AlgoliaSearch.SearchResult;

@Service
@Transactional(readOnly = true)
public class SearchApiService {

    private final AlgoliaSearch algoliaSearch;

    public SearchApiService(AlgoliaSearch algoliaSearch) {
        this.algoliaSearch = algoliaSearch;
    }

    public SearchResult search(String query, String userId) {
        return algoliaSearch.searchDetailed(query);
    }
}
