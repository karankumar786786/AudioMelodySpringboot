package me.one_org.melody.Services.General;

import java.util.Optional;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import me.one_org.melody.Entity.PaginationMetaData;
import me.one_org.melody.Repository.PaginationMetaDataRepository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PaginationMetaDataServiceTest {

    @Mock
    private PaginationMetaDataRepository repository;

    @InjectMocks
    private PaginationMetaDataService paginationMetaDataService;

    @Test
    @DisplayName("getMetaData should return existing metadata if found")
    void getMetaDataExisting() {
        PaginationMetaData meta = PaginationMetaData.builder()
                .tableName("SongsEntity")
                .totalCount(150L)
                .build();
        when(repository.findByEntityName("SongsEntity")).thenReturn(Optional.of(meta));

        PaginationMetaData result = paginationMetaDataService.getMetaData("SongsEntity");
        assertThat(result.getTotalCount()).isEqualTo(150L);
    }

    @Test
    @DisplayName("getMetaData should initialize and save new metadata if not found")
    void getMetaDataNew() {
        when(repository.findByEntityName("NewEntity")).thenReturn(Optional.empty());

        PaginationMetaData result = paginationMetaDataService.getMetaData("NewEntity");
        assertThat(result.getTableName()).isEqualTo("NewEntity");
        assertThat(result.getTotalCount()).isEqualTo(0L);
        verify(repository).save(any(PaginationMetaData.class));
    }

    @Test
    @DisplayName("updateCounts should update and persist count totals")
    void updateCounts() {
        PaginationMetaData existing = PaginationMetaData.builder()
                .tableName("ArtistsEntity")
                .totalCount(10L)
                .build();
        when(repository.findByEntityName("ArtistsEntity")).thenReturn(Optional.of(existing));

        paginationMetaDataService.updateCounts("ArtistsEntity", 20L, 18L, 1L, 1L);

        assertThat(existing.getTotalCount()).isEqualTo(20L);
        assertThat(existing.getActiveCount()).isEqualTo(18L);
        verify(repository).save(existing);
    }
}
