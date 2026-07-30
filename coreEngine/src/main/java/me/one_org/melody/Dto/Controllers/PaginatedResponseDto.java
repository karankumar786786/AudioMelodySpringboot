package me.one_org.melody.Dto.Controllers;

import java.util.List;
import me.one_org.melody.Entity.PaginationMetaDataEntity;

public record PaginatedResponseDto<T>(
    List<T> content,
    int page,
    int size,
    PaginationMetaDataEntity paginationMetaData
) {}
