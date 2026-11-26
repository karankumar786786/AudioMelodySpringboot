package me.one_org.melody.Repository;

import me.one_org.melody.Entity.PaginationMetaData;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

/**
 * Table pagination_metadata ke liye queries (har table ke pehle se gine hue counts).
 *
 * Repository = database se baat karne wali layer. Spring Data JPA in interfaces ka code khud bana deta hai:
 * method ka naam (findByEmail) ya @Query likho, SQL Spring chala dega.
 * @EntityGraph = related data (jaise songMetadata) ek hi query me saath laao, alag query (N+1 problem) se bacho.
 * @Modifying = ye query data badalti hai (UPDATE/DELETE), sirf padhti nahi.
 */
public interface PaginationMetaDataRepository extends JpaRepository<PaginationMetaData, String> {

    /** Table/entity ke naam se uske counts. */
    Optional<PaginationMetaData> findByTableName(String tableName);

    /** Upar wale ka doosra naam. */
    default Optional<PaginationMetaData> findByEntityName(String entityName) {
        return findByTableName(entityName);
    }

    /** Kisi naam ke counts wali row hatao. */
    @Modifying
    @Transactional
    @Query("DELETE FROM PaginationMetaData p WHERE p.tableName = :tableName")
    void deleteByTableName(@Param("tableName") String tableName);

    /** Upar wale ka doosra naam. */
    default void deleteByEntityName(String entityName) {
        deleteByTableName(entityName);
    }
}
