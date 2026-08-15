package me.one_org.melody.Controllers.Webhook;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import me.one_org.melody.Services.Webhook.WebhookDeleteService;

@RestController
@RequestMapping("/webhook/delete")
public class WebhookDeleteController {

    private final WebhookDeleteService deleteService;

    public WebhookDeleteController(WebhookDeleteService deleteService) {
        this.deleteService = deleteService;
    }

    @PostMapping("/{entityType}/{entityId}/delete-search")
    public ResponseEntity<Void> deleteSearch(@PathVariable String entityType, @PathVariable String entityId) {
        deleteService.deleteSearch(entityType, entityId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{entityType}/{entityId}/delete-recommendation")
    public ResponseEntity<Void> deleteRecommendation(@PathVariable String entityType, @PathVariable String entityId) {
        deleteService.deleteRecommendation(entityType, entityId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{entityType}/{entityId}/delete-imagekit")
    public ResponseEntity<Void> deleteImageKit(@PathVariable String entityType, @PathVariable String entityId) {
        deleteService.deleteImageKit(entityType, entityId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{entityType}/{entityId}/hard-delete")
    public ResponseEntity<Void> hardDelete(@PathVariable String entityType, @PathVariable String entityId) {
        deleteService.hardDelete(entityType, entityId);
        return ResponseEntity.ok().build();
    }
}