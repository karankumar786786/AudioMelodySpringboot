package me.one_org.melody.Controllers.Api;

import java.util.concurrent.TimeUnit;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import me.one_org.melody.Dto.AlgoliaSearch.AlgoliaClientConfigDto;
import me.one_org.melody.Dto.AlgoliaSearch.SearchResult;
import me.one_org.melody.Services.Api.SearchApiService;

@RestController
@RequestMapping("/api/search")
public class AlgoliaApiController {

    private final SearchApiService searchApiService;

    public AlgoliaApiController(SearchApiService searchApiService) {
        this.searchApiService = searchApiService;
    }

    @GetMapping("/config")
    public ResponseEntity<AlgoliaClientConfigDto> getSearchConfig() {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(1, TimeUnit.HOURS).cachePublic())
                .body(searchApiService.getFrontendSearchConfig());
    }

    @GetMapping
    public ResponseEntity<SearchResult> search(
            @RequestParam String q,
            @RequestAttribute(value = "userId", required = false) String userId) {
        return ResponseEntity.ok(searchApiService.search(q, userId));
    }
}
