package me.one_org.melody.Controllers.Admin;

import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import me.one_org.melody.Services.Admin.AdminSyncService;

@RestController
@RequestMapping("/admin/sync")
public class SyncController {

    private final AdminSyncService adminSyncService;

    public SyncController(AdminSyncService adminSyncService) {
        this.adminSyncService = adminSyncService;
    }

    @PostMapping("/algolia")
    public ResponseEntity<Map<String, String>> resyncAlgolia() {
        adminSyncService.resyncAlgolia();
        return ResponseEntity.ok(Map.of("status", "Algolia resync completed"));
    }

    @PostMapping("/recombee")
    public ResponseEntity<Map<String, String>> resyncRecombee() {
        adminSyncService.resyncRecombee();
        return ResponseEntity.ok(Map.of("status", "Recombee resync completed"));
    }

    @PostMapping("/all")
    public ResponseEntity<Map<String, String>> resyncAll() {
        adminSyncService.resyncAll();
        return ResponseEntity.ok(Map.of("status", "Full resync completed"));
    }
}
