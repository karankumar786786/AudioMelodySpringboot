package me.one_org.melody.Controllers.Webhook;

import java.util.Map;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

import me.one_org.melody.Configuration.FeignClientConfig;
import me.one_org.melody.Dto.Queue.JobCleanupRequestDto;

@FeignClient(name = "audio-processing-api", url = "${audio-processing.api.url}", configuration = FeignClientConfig.class)
public interface ApiHook {

    @PostMapping("/api/jobs/{jobId}/cleanup")
    ResponseEntity<Map<String, Object>> cleanupJob(
            @PathVariable("jobId") String jobId,
            @RequestBody JobCleanupRequestDto request
    );

    @PostMapping("/api/jobs/{jobId}/cancel")
    ResponseEntity<Map<String, Object>> cancelJob(
            @PathVariable("jobId") String jobId
    );
}
