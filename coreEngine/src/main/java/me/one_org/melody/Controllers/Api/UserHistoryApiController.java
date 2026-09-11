package me.one_org.melody.Controllers.Api;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import me.one_org.melody.Dto.Controllers.Api.SaveSearchHistoryRequestDto;
import me.one_org.melody.Dto.Controllers.Api.UserHistoryResponseDto;
import me.one_org.melody.Dto.Controllers.Api.UserSearchHistoryGroupedResponseDto;
import me.one_org.melody.Services.Api.UserHistoryApiService;

@RestController
@RequestMapping("/api/user/history")
public class UserHistoryApiController {

    private final UserHistoryApiService userHistoryAppService;

    public UserHistoryApiController(UserHistoryApiService userHistoryAppService) {
        this.userHistoryAppService = userHistoryAppService;
    }

    @GetMapping("/recent")
    public ResponseEntity<List<UserHistoryResponseDto>> getRecentlyPlayed(
            @RequestAttribute("userId") String userId) {
        return ResponseEntity.ok(userHistoryAppService.getRecentlyPlayed(userId));
    }

    @GetMapping("/search")
    public ResponseEntity<UserSearchHistoryGroupedResponseDto> getSearchHistory(
            @RequestAttribute("userId") String userId) {
        return ResponseEntity.ok(userHistoryAppService.getSearchHistory(userId));
    }

    @PostMapping("/search")
    public ResponseEntity<Void> saveSearchHistory(
            @RequestAttribute("userId") String userId,
            @Valid @RequestBody SaveSearchHistoryRequestDto data) {
        userHistoryAppService.saveSearchHistory(userId, data);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/search/{id}")
    public ResponseEntity<Void> deleteSearchHistoryItem(
            @RequestAttribute("userId") String userId,
            @PathVariable("id") String id) {
        userHistoryAppService.deleteSearchHistoryItem(userId, id);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/search")
    public ResponseEntity<Void> clearSearchHistory(
            @RequestAttribute("userId") String userId) {
        userHistoryAppService.clearSearchHistory(userId);
        return ResponseEntity.ok().build();
    }
}
