package me.one_org.melody.Dto.Controllers;

import java.util.List;
import me.one_org.melody.Dto.Controllers.Api.PaginationMetaDataDto;
import me.one_org.melody.Entity.PaginationMetaData;

/**
 * Page by page list ka standard jawab: items (content), page number, page size aur total counts.
 */
public record PaginatedResponseDto<T>(
    List<T> content,
    int page,
    int size,
    PaginationMetaDataDto paginationMetaData
) {
    public PaginatedResponseDto(List<T> content, int page, int size, PaginationMetaData metaData) {
        this(content, page, size, PaginationMetaDataDto.fromEntity(metaData));
    }

    public static <T> PaginatedResponseDto<T> empty(int page, int size) {
        return new PaginatedResponseDto<>(List.of(), page, size, (PaginationMetaDataDto) null);
    }
}
