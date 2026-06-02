package me.one_org.melody.Webhook;

import org.springframework.cloud.openfeign.FeignClient;

@FeignClient(name = "audio-processing",url = "${audio-processing.api.url}")
public interface ApiHook {
    
}
