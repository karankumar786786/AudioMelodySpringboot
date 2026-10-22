package me.one_org.melody.Controllers.User;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import me.one_org.melody.Dto.Controllers.Api.UserDto;
import me.one_org.melody.Dto.Controllers.User.UpdateProfileRequestDto;
import me.one_org.melody.Entity.User;
import me.one_org.melody.Security.CurrentUser;
import me.one_org.melody.Security.CustomUserDetails;
import me.one_org.melody.Services.General.UserService;

@RestController
@RequestMapping("/api/user/profile")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping
    public ResponseEntity<UserDto> getProfile(@CurrentUser CustomUserDetails currentUser) {
        User user = userService.getUserProfile(currentUser.getId());
        return ResponseEntity.ok(UserDto.fromEntity(user));
    }

    @PutMapping
    public ResponseEntity<UserDto> updateProfile(
            @CurrentUser CustomUserDetails currentUser,
            @RequestParam(required = false) String userName,
            @RequestBody(required = false) UpdateProfileRequestDto body) {
        String effectiveName = (body != null && body.userName() != null && !body.userName().isBlank())
                ? body.userName()
                : userName;
        User user = userService.updateProfile(currentUser.getId(), effectiveName);
        return ResponseEntity.ok(UserDto.fromEntity(user));
    }
}
