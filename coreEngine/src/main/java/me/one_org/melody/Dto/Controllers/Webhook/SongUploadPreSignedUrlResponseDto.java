package me.one_org.melody.Dto.Controllers.Webhook;

public record SongUploadPreSignedUrlResponseDto(
    String key,
    String preSignedUrl
) {
}
