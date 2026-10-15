package me.one_org.melody.Dto.Controllers;

import java.util.List;
import me.one_org.melody.Dto.Controllers.Api.PaginationMetaDataDto;
import me.one_org.melody.Entity.PaginationMetaData;

public record PaginatedResponseDto<T>(
    List<T> content,
    int page,
    int size,
    PaginationMetaDataDto paginationMetaData
) {
    public PaginatedResponseDto(List<T> content, int page, int size, PaginationMetaData metaData) {
        this(content, page, size, PaginationMetaDataDto.fromEntity(metaData));
    }
}
