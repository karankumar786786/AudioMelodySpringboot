package me.one_org.melody.Controllers.Admin;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import me.one_org.melody.Dto.Controllers.PaginatedResponseDto;
import me.one_org.melody.Entity.PaginationMetaDataEntity;
import me.one_org.melody.Entity.UsersEntity;
import me.one_org.melody.Services.Admin.AccountService;

@RestController
@RequestMapping("/admin/account")
public class AccountController {

    private final AccountService accountService;

    public AccountController(AccountService accountService) {
        this.accountService = accountService;
    }

    @GetMapping
    public ResponseEntity<PaginatedResponseDto<UsersEntity>> getAllAccounts(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        List<UsersEntity> users = accountService.getAccountsPaginated(page, size);
        PaginationMetaDataEntity metaData = accountService.getPaginationMetaData();
        return ResponseEntity.ok(new PaginatedResponseDto<>(users, page, size, metaData));
    }

    @DeleteMapping("/{email}")
    public ResponseEntity<Void> deleteAccount(@PathVariable String email) {
        accountService.deleteAccount(email);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{email}")
    public ResponseEntity<Void> upgradeToAdmin(@PathVariable String email) {
        accountService.upgradeToAdmin(email);
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(null);
    }
}
