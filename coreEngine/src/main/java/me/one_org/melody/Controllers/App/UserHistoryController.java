package me.one_org.melody.Controllers.App;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

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
    public ResponseEntity<List<UserHistoryEntity>> getHistory(
            @RequestAttribute("userId") String userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(userHistoryAppService.getHistory(userId, page, size));
    }

    @DeleteMapping
    public ResponseEntity<Void> clearHistory(
            @RequestAttribute("userId") String userId) {
        userHistoryAppService.clearHistory(userId);
        return ResponseEntity.noContent().build();
    }
}
