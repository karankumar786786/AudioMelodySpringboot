package me.one_org.melody.Controllers.User;

import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import me.one_org.melody.Dto.Controllers.Api.UserDto;
import me.one_org.melody.Dto.Controllers.User.UpdateProfileRequestDto;
import me.one_org.melody.Entity.User;
import me.one_org.melody.Security.CurrentUser;
import me.one_org.melody.Security.CustomUserDetails;
import me.one_org.melody.Services.General.UserService;

@RestController
@RequestMapping("/api/user/profile")
@Validated
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
            @Valid @RequestBody UpdateProfileRequestDto body) {
        User user = userService.updateProfile(currentUser.getId(), body.userName().trim());
        return ResponseEntity.ok(UserDto.fromEntity(user));
    }
}
