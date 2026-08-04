package me.one_org.melody.Dto.Controllers.Admin;

public record SongUploadPreSignedUrlResponseDto(
    String key,
    String preSignedUrl
) {
}
