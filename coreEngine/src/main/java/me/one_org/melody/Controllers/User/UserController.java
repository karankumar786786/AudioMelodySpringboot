package me.one_org.melody.Controllers.User;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import me.one_org.melody.Entity.UsersEntity;
import me.one_org.melody.Services.General.UserService;

@RestController
@RequestMapping("/api/user/profile")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping
    public ResponseEntity<UsersEntity> getProfile(@RequestAttribute("userId") String userId) {
        return ResponseEntity.ok(userService.getUserProfile(userId));
    }

    @PutMapping
    public ResponseEntity<UsersEntity> updateProfile(
            @RequestAttribute("userId") String userId,
            @RequestParam(required = false) String userName) {
        return ResponseEntity.ok(userService.updateProfile(userId, userName));
    }
}
