package me.one_org.melody.imagekit;

import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class ImageKit {
    @Autowired
    private io.imagekit.sdk.ImageKit imageKitSdk;

    @SuppressWarnings("unchecked")
    public Map<String,String> preSignedToken(){
        Map<String, String> params = (Map<String, String>) (Map<?, ?>) imageKitSdk.getAuthenticationParameters();
        return params;
    }
}
