package me.one_org.melody.Controllers.Api;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import me.one_org.melody.Dto.AlgoliaSearch.SearchResult;
import me.one_org.melody.Security.CurrentUser;
import me.one_org.melody.Security.CustomUserDetails;
import me.one_org.melody.Services.Api.SearchApiService;

@RestController
@RequestMapping("/api/search")
public class AlgoliaApiController {

    private final SearchApiService searchApiService;

    public AlgoliaApiController(SearchApiService searchApiService) {
        this.searchApiService = searchApiService;
    }

    @GetMapping
    public ResponseEntity<SearchResult> search(
            @RequestParam String q,
            @CurrentUser CustomUserDetails currentUser) {
        String userId = currentUser != null ? currentUser.getId() : null;
        return ResponseEntity.ok(searchApiService.search(q, userId));
    }
}
