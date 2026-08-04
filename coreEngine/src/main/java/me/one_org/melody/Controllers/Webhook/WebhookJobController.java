package me.one_org.melody.Controllers.Webhook;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import me.one_org.melody.Dto.Webhook.JobFailedRequestDto;
import me.one_org.melody.Dto.Webhook.JobStartedRequestDto;
import me.one_org.melody.Dto.Webhook.TranscodedRequestDto;
import me.one_org.melody.Entity.JobsEntity;
import me.one_org.melody.Services.Webhook.WebhookJobService;

@RestController
@RequestMapping("/webhook/job")
public class WebhookJobController {

    private final WebhookJobService webhookService;

    public WebhookJobController(WebhookJobService webhookService) {
        this.webhookService = webhookService;
    }

    @GetMapping("/{jobId}")
    public ResponseEntity<JobsEntity> getJob(@PathVariable String jobId) {
        JobsEntity job = webhookService.getJob(jobId);
        return ResponseEntity.ok(job);
    }

    @PostMapping("/{jobId}/transcoding-started")
    public ResponseEntity<Void> transcodingStarted(
            @PathVariable String jobId,
            @Valid @RequestBody JobStartedRequestDto data) {
        webhookService.transcodingStarted(jobId, data);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{jobId}/transcoded")
    public ResponseEntity<Void> transcoded(
            @PathVariable String jobId,
            @Valid @RequestBody TranscodedRequestDto data) {
        webhookService.transcoded(jobId, data);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{jobId}/save-recommendation")
    public ResponseEntity<Void> saveRecommendation(@PathVariable String jobId) {
        webhookService.saveRecommendation(jobId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{jobId}/save-search")
    public ResponseEntity<Void> saveSearch(@PathVariable String jobId) {
        webhookService.saveSearch(jobId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{jobId}/finalize")
    public ResponseEntity<Void> finalizeJob(@PathVariable String jobId) {
        webhookService.finalizeJob(jobId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{jobId}/failed")
    public ResponseEntity<Void> failed(
            @PathVariable String jobId,
            @Valid @RequestBody JobFailedRequestDto data) {
        webhookService.failed(jobId, data);
        return ResponseEntity.ok().build();
    }
}
