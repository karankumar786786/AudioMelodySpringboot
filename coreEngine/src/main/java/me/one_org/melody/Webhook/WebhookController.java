package me.one_org.melody.Webhook;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import me.one_org.melody.Dto.Webhook.JobFailedRequestDto;
import me.one_org.melody.Dto.Webhook.JobStartedRequestDto;
import me.one_org.melody.Dto.Webhook.TranscodedRequestDto;
import me.one_org.melody.Dto.Webhook.TranscribedRequestDto;
import me.one_org.melody.Entity.JobsEntity;

@RestController
@RequestMapping("/webhook/job")
public class WebhookController {

    private final WebhookService webhookService;

    public WebhookController(WebhookService webhookService) {
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

    @PostMapping("/{jobId}/transcribing-started")
    public ResponseEntity<Void> transcribingStarted(
            @PathVariable String jobId,
            @Valid @RequestBody JobStartedRequestDto data) {
        webhookService.transcribingStarted(jobId, data);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{jobId}/transcribed")
    public ResponseEntity<Void> transcribed(
            @PathVariable String jobId,
            @Valid @RequestBody TranscribedRequestDto data) {
        webhookService.transcribed(jobId, data);
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
