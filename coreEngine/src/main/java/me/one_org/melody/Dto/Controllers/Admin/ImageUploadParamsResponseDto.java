package me.one_org.melody.Dto.Controllers.Admin;

import java.util.Map;

public record ImageUploadParamsResponseDto(
    String key,
    Map<String,String> param
) {
    
}
