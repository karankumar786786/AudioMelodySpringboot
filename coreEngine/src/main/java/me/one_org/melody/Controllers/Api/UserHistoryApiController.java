package me.one_org.melody.Controllers.Api;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import me.one_org.melody.Dto.Controllers.PaginatedResponseDto;
import me.one_org.melody.Entity.PaginationMetaDataEntity;
import me.one_org.melody.Entity.UserHistoryEntity;
import me.one_org.melody.Services.Api.UserHistoryApiService;

@RestController
@RequestMapping("/api/user/history")
public class UserHistoryApiController {

    private final UserHistoryApiService userHistoryAppService;

    public UserHistoryApiController(UserHistoryApiService userHistoryAppService) {
        this.userHistoryAppService = userHistoryAppService;
    }

    @GetMapping
    public ResponseEntity<PaginatedResponseDto<UserHistoryEntity>> getHistory(
            @RequestAttribute("userId") String userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        List<UserHistoryEntity> history = userHistoryAppService.getHistory(userId, page, size);
        PaginationMetaDataEntity metaData = userHistoryAppService.getPaginationMetaData(userId);
        return ResponseEntity.ok(new PaginatedResponseDto<>(history, page, size, metaData));
    }

    @DeleteMapping
    public ResponseEntity<Void> clearHistory(
            @RequestAttribute("userId") String userId) {
        userHistoryAppService.clearHistory(userId);
        return ResponseEntity.noContent().build();
    }
}
