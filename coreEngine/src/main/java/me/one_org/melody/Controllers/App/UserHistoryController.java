package me.one_org.melody.Controllers.App;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import me.one_org.melody.Dto.Controllers.PaginatedResponseDto;
import me.one_org.melody.Entity.PaginationMetaDataEntity;
import me.one_org.melody.Entity.UserHistoryEntity;
import me.one_org.melody.Services.App.UserHistoryAppService;

@RestController
@RequestMapping("/app/user/history")
public class UserHistoryController {

    private final UserHistoryAppService userHistoryAppService;

    public UserHistoryController(UserHistoryAppService userHistoryAppService) {
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
