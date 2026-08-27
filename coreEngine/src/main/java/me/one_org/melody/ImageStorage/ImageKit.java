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
        String token = java.util.UUID.randomUUID().toString();
        long expireInSeconds = (System.currentTimeMillis() / 1000) + 1800;
        Map<String, String> params = (Map<String, String>) (Map<?, ?>) imageKitSdk.getAuthenticationParameters(token, expireInSeconds);
        return params;
    }

    public void deleteByKey(String key) {
        if (key == null || key.isBlank()) return;
        try {
            String fileName = key.contains("/") ? key.substring(key.lastIndexOf('/') + 1) : key;
            io.imagekit.sdk.models.GetFileListRequest request = new io.imagekit.sdk.models.GetFileListRequest();
            request.setName(fileName);
            io.imagekit.sdk.models.results.ResultList result = imageKitSdk.getFileList(request);
            if (result != null && result.getResults() != null && !result.getResults().isEmpty()) {
                for (var file : result.getResults()) {
                    if (file.getFilePath().equals(key) || file.getName().equals(fileName)) {
                        imageKitSdk.deleteFile(file.getFileId());
                    }
                }
            } else {
                imageKitSdk.deleteFile(key);
            }
        } catch (Exception e) {
            // log and swallow deletion error so business flow is not blocked
        }
    }
}
