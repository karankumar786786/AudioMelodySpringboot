package me.one_org.melody.Controllers.User;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import me.one_org.melody.Dto.Controllers.Api.UserDto;
import me.one_org.melody.Entity.User;
import me.one_org.melody.Services.General.UserService;

@RestController
@RequestMapping("/api/user/profile")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping
    public ResponseEntity<UserDto> getProfile(@RequestAttribute("userId") String userId) {
        User user = userService.getUserProfile(userId);
        return ResponseEntity.ok(UserDto.fromEntity(user));
    }

    @PutMapping
    public ResponseEntity<UserDto> updateProfile(
            @RequestAttribute("userId") String userId,
            @RequestParam(required = false) String userName) {
        User user = userService.updateProfile(userId, userName);
        return ResponseEntity.ok(UserDto.fromEntity(user));
    }
}
