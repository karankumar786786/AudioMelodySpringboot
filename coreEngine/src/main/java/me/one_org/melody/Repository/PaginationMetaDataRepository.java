package me.one_org.melody.Repository;

import me.one_org.melody.Entity.PaginationMetaData;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Repository
public interface PaginationMetaDataRepository extends JpaRepository<PaginationMetaData, String> {

    Optional<PaginationMetaData> findByTableName(String tableName);

    default Optional<PaginationMetaData> findByEntityName(String entityName) {
        return findByTableName(entityName);
    }

    @Modifying
    @Transactional
    @Query("DELETE FROM PaginationMetaData p WHERE p.tableName = :tableName")
    void deleteByTableName(@Param("tableName") String tableName);

    default void deleteByEntityName(String entityName) {
        deleteByTableName(entityName);
    }
}
