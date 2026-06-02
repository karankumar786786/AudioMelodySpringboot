package me.one_org.melody.Webhook;

import org.springframework.cloud.openfeign.FeignClient;

import me.one_org.melody.Configuration.FeignClientConfig;

@FeignClient(name = "audio-processing-api",url = "${audio-processing.api.url}",configuration = FeignClientConfig.class)
public interface ApiHook {
    
}
