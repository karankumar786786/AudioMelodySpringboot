package me.one_org.melody.Controllers.Api;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import me.one_org.melody.Entity.UserSearchHistoryEntity;
import me.one_org.melody.Services.Api.UserHistoryApiService;

@RestController
@RequestMapping("/api/user/history")
public class UserHistoryApiController {

    private final UserHistoryApiService userHistoryAppService;

    public UserHistoryApiController(UserHistoryApiService userHistoryAppService) {
        this.userHistoryAppService = userHistoryAppService;
    }


    @GetMapping("/search")
    public ResponseEntity<List<UserSearchHistoryEntity>> getSearchHistory(
            @RequestAttribute("userId") String userId) {
        return ResponseEntity.ok(userHistoryAppService.getSearchHistory(userId));
    }
}
