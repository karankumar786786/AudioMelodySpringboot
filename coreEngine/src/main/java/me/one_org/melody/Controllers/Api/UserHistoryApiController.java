package me.one_org.melody.Controllers.Api;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import org.springframework.web.bind.annotation.RequestParam;

import org.springframework.validation.annotation.Validated;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import me.one_org.melody.Dto.Controllers.PaginatedResponseDto;
import me.one_org.melody.Dto.Controllers.Api.PaginationMetaDataDto;
import me.one_org.melody.Dto.Controllers.Api.SaveSearchHistoryRequestDto;
import me.one_org.melody.Dto.Controllers.Api.UserHistoryResponseDto;
import me.one_org.melody.Dto.Controllers.Api.UserSearchHistoryGroupedResponseDto;
import me.one_org.melody.Security.CurrentUser;
import me.one_org.melody.Security.CustomUserDetails;
import me.one_org.melody.Services.Api.UserHistoryApiService;

/**
 * User ki listening history aur recent searches ki API.
 *
 * Controller = HTTP request ka pehla stop. Ye sirf request padhta hai, service ko kaam deta hai,
 * aur response (JSON) lautata hai. Asli logic service me hai.
 */
@RestController
@RequestMapping("/api/user/history")
@Validated
public class UserHistoryApiController {

    private final UserHistoryApiService userHistoryAppService;

    public UserHistoryApiController(UserHistoryApiService userHistoryAppService) {
        this.userHistoryAppService = userHistoryAppService;
    }

    /** GET /api/user/history - poori listening history, naya pehle, page by page. */
    @GetMapping
    public ResponseEntity<PaginatedResponseDto<UserHistoryResponseDto>> getHistory(
            @CurrentUser CustomUserDetails currentUser,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        List<UserHistoryResponseDto> history = userHistoryAppService.getHistory(currentUser.getId(), page, size);
        PaginationMetaDataDto meta = userHistoryAppService.getPaginationMetaData(currentUser.getId());
        return ResponseEntity.ok(new PaginatedResponseDto<>(history, page, size, meta));
    }

    /** GET /api/user/history/recent - recently played (har gaana ek baar). */
    @GetMapping("/recent")
    public ResponseEntity<List<UserHistoryResponseDto>> getRecentlyPlayed(
            @CurrentUser CustomUserDetails currentUser) {
        return ResponseEntity.ok(userHistoryAppService.getRecentlyPlayed(currentUser.getId()));
    }

    /** GET /api/user/history/search - recent searches (type ke hisaab se group). */
    @GetMapping("/search")
    public ResponseEntity<UserSearchHistoryGroupedResponseDto> getSearchHistory(
            @CurrentUser CustomUserDetails currentUser) {
        return ResponseEntity.ok(userHistoryAppService.getSearchHistory(currentUser.getId()));
    }

    /** POST /api/user/history/search - search se kholi cheez recent searches me save karo. */
    @PostMapping("/search")
    public ResponseEntity<Void> saveSearchHistory(
            @CurrentUser CustomUserDetails currentUser,
            @Valid @RequestBody SaveSearchHistoryRequestDto data) {
        userHistoryAppService.saveSearchHistory(currentUser.getId(), data);
        return ResponseEntity.ok().build();
    }

    /** DELETE /api/user/history/search/{id} - ek recent search hatao. */
    @DeleteMapping("/search/{id}")
    public ResponseEntity<Void> deleteSearchHistoryItem(
            @CurrentUser CustomUserDetails currentUser,
            @PathVariable("id") @NotBlank(message = "Search item ID is required") String id) {
        userHistoryAppService.deleteSearchHistoryItem(currentUser.getId(), id);
        return ResponseEntity.ok().build();
    }

    /** DELETE /api/user/history/search - saari recent searches saaf karo. */
    @DeleteMapping("/search")
    public ResponseEntity<Void> clearSearchHistory(
            @CurrentUser CustomUserDetails currentUser) {
        userHistoryAppService.clearSearchHistory(currentUser.getId());
        return ResponseEntity.ok().build();
    }
}
