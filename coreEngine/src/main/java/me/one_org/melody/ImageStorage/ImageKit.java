package me.one_org.melody.ImageStorage;

import java.util.Map;

import org.springframework.stereotype.Component;



@Component
public class ImageKit {

    private final io.imagekit.sdk.ImageKit imageKitSdk;

    public ImageKit(io.imagekit.sdk.ImageKit imageKit){
        this.imageKitSdk = imageKit;
    }

    @SuppressWarnings("unchecked")
    public Map<String,String> preSignedToken(){
        Map<String, String> params = (Map<String, String>) (Map<?, ?>) imageKitSdk.getAuthenticationParameters();
        return params;
    }

    public void deleteByKey(String key){
        try {
            imageKitSdk.deleteFile(key);
        } catch (Exception e) {
            // handle exception
        }
    }
}
