package me.one_org.melody.Controllers.Api;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import me.one_org.melody.Dto.Controllers.Api.UserHistoryResponseDto;
import me.one_org.melody.Dto.Controllers.PaginatedResponseDto;
import me.one_org.melody.Entity.PaginationMetaDataEntity;
import me.one_org.melody.Entity.UserSearchHistoryEntity;
import me.one_org.melody.Services.Api.UserHistoryApiService;

@RestController
@RequestMapping("/api/user/history")
public class UserHistoryApiController {

    private final UserHistoryApiService userHistoryAppService;

    public UserHistoryApiController(UserHistoryApiService userHistoryAppService) {
        this.userHistoryAppService = userHistoryAppService;
    }

    @GetMapping
    public ResponseEntity<PaginatedResponseDto<UserHistoryResponseDto>> getHistory(
            @RequestAttribute("userId") String userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        List<UserHistoryResponseDto> history = userHistoryAppService.getHistory(userId, page, size);
        PaginationMetaDataEntity metaData = userHistoryAppService.getPaginationMetaData(userId);
        return ResponseEntity.ok(new PaginatedResponseDto<>(history, page, size, metaData));
    }


    @GetMapping("/search")
    public ResponseEntity<List<UserSearchHistoryEntity>> getSearchHistory(
            @RequestAttribute("userId") String userId) {
        return ResponseEntity.ok(userHistoryAppService.getSearchHistory(userId));
    }
}
