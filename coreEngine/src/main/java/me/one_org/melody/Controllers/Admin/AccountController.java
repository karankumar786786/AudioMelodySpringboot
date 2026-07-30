package me.one_org.melody.Controllers.Admin;

// import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

// import me.one_org.melody.Entity.UsersEntity;
import me.one_org.melody.Services.Admin.AccountService;
import org.springframework.web.bind.annotation.PostMapping;


@RestController
@RequestMapping("/admin/account")
public class AccountController {

    private final AccountService accountService;

    public AccountController(AccountService accountService) {
        this.accountService = accountService;
    }

    // @GetMapping
    // public ResponseEntity<List<UsersEntity>> getAllAccounts() {
    //     return ResponseEntity.ok(accountService.getAllAccounts());
    // }

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
