package me.one_org.melody.Controllers.Api;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import org.springframework.validation.annotation.Validated;
import jakarta.validation.constraints.NotBlank;
import me.one_org.melody.Dto.AlgoliaSearch.SearchResult;
import me.one_org.melody.Security.CurrentUser;
import me.one_org.melody.Security.CustomUserDetails;
import me.one_org.melody.Services.Api.SearchApiService;

/**
 * Search API: /api/search?q=...
 * Flow: app -> yahan -> SearchApiService -> Algolia.
 *
 * Controller = HTTP request ka pehla stop. Ye sirf request padhta hai, service ko kaam deta hai,
 * aur response (JSON) lautata hai. Asli logic service me hai.
 */
@RestController
@RequestMapping("/api/search")
@Validated
public class AlgoliaApiController {

    private final SearchApiService searchApiService;

    public AlgoliaApiController(SearchApiService searchApiService) {
        this.searchApiService = searchApiService;
    }

    /** GET /api/search?q=... - songs, artists, playlists aur user playlists ek saath dhoondo. */
    @GetMapping
    public ResponseEntity<SearchResult> search(
            @RequestParam @NotBlank(message = "Search query is required") String q,
            @CurrentUser CustomUserDetails currentUser) {
        String userId = currentUser != null ? currentUser.getId() : null;
        return ResponseEntity.ok(searchApiService.search(q, userId));
    }
}
