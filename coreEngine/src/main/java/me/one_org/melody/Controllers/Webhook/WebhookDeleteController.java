package me.one_org.melody.Controllers.Webhook;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import me.one_org.melody.Dto.Webhook.JobFailedRequestDto;
import me.one_org.melody.Services.Webhook.WebhookDeleteService;

@RestController
@RequestMapping("/webhook/delete")
public class WebhookDeleteController {

    private final WebhookDeleteService deleteService;

    public WebhookDeleteController(WebhookDeleteService deleteService) {
        this.deleteService = deleteService;
    }

    @PostMapping("/{entityType}/{entityId}/delete-search")
    public ResponseEntity<Void> deleteSearch(
            @PathVariable String entityType,
            @PathVariable String entityId,
            @RequestParam(required = false) String deleteJobId) {
        deleteService.deleteSearch(entityType, entityId, deleteJobId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{entityType}/{entityId}/delete-recommendation")
    public ResponseEntity<Void> deleteRecommendation(
            @PathVariable String entityType,
            @PathVariable String entityId,
            @RequestParam(required = false) String deleteJobId) {
        deleteService.deleteRecommendation(entityType, entityId, deleteJobId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{entityType}/{entityId}/delete-imagekit")
    public ResponseEntity<Void> deleteImageKit(
            @PathVariable String entityType,
            @PathVariable String entityId,
            @RequestParam(required = false) String deleteJobId) {
        deleteService.deleteImageKit(entityType, entityId, deleteJobId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{entityType}/{entityId}/delete-s3")
    public ResponseEntity<Void> deleteS3(
            @PathVariable String entityType,
            @PathVariable String entityId,
            @RequestParam(required = false) String deleteJobId) {
        deleteService.deleteS3(entityType, entityId, deleteJobId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{entityType}/{entityId}/hard-delete")
    public ResponseEntity<Void> hardDelete(
            @PathVariable String entityType,
            @PathVariable String entityId,
            @RequestParam(required = false) String deleteJobId) {
        deleteService.hardDelete(entityType, entityId, deleteJobId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{entityType}/{entityId}/failed")
    public ResponseEntity<Void> failed(
            @PathVariable String entityType,
            @PathVariable String entityId,
            @RequestParam(required = false) String deleteJobId,
            @RequestBody(required = false) JobFailedRequestDto data) {
        String reason = (data != null && data.reason() != null && !data.reason().isBlank())
                ? data.reason()
                : "Cascade delete failed";
        deleteService.failed(entityType, entityId, deleteJobId, reason);
        return ResponseEntity.ok().build();
    }
}