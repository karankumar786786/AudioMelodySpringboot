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
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String role,
            @RequestParam(required = false) String status) {
        List<UsersEntity> users = accountService.getAccountsPaginated(page, size, search, role, status);
        PaginationMetaDataEntity metaData = accountService.getPaginationMetaData();

        boolean hasFilters = (search != null && !search.trim().isEmpty())
                || (role != null && !role.trim().isEmpty() && !role.equalsIgnoreCase("ALL"))
                || (status != null && !status.trim().isEmpty() && !status.equalsIgnoreCase("ALL"));

        long totalCount = hasFilters
                ? accountService.countAccounts(search, role, status)
                : (metaData != null && metaData.getTotalCount() > 0
                        ? metaData.getTotalCount()
                        : accountService.countAccounts(null, null, null));

        PaginationMetaDataEntity responseMeta = PaginationMetaDataEntity.builder()
                .id(metaData != null ? metaData.getId() : "UsersEntity")
                .entityName("UsersEntity")
                .totalCount(totalCount)
                .activeCount(metaData != null ? metaData.getActiveCount() : totalCount)
                .blockedCount(metaData != null ? metaData.getBlockedCount() : 0L)
                .deletedCount(metaData != null ? metaData.getDeletedCount() : 0L)
                .build();

        return ResponseEntity.ok(new PaginatedResponseDto<>(users, page, size, responseMeta));
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

    @PostMapping("/{email}/block")
    public ResponseEntity<Void> blockAccount(@PathVariable String email) {
        accountService.blockAccount(email);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{email}/unblock")
    public ResponseEntity<Void> unblockAccount(@PathVariable String email) {
        accountService.unblockAccount(email);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{email}/demote")
    public ResponseEntity<Void> demoteToUser(@PathVariable String email) {
        accountService.demoteToUser(email);
        return ResponseEntity.ok().build();
    }
}
