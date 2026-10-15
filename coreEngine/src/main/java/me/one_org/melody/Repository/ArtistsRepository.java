package me.one_org.melody.Repository;

import me.one_org.melody.Entity.Artist;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ArtistsRepository extends JpaRepository<Artist, String> {

    @Override
    @EntityGraph(attributePaths = {"artistMetadata"})
    Optional<Artist> findById(String id);

    @EntityGraph(attributePaths = {"artistMetadata"})
    @Query("SELECT a FROM Artist a WHERE LOWER(TRIM(a.name)) = LOWER(TRIM(:name))")
    List<Artist> findByNameIgnoreCaseList(@Param("name") String name, Pageable pageable);

    default Optional<Artist> findByNameIgnoreCase(String name) {
        if (name == null || name.isBlank()) return Optional.empty();
        List<Artist> list = findByNameIgnoreCaseList(name, PageRequest.of(0, 1));
        return list.isEmpty() ? Optional.empty() : Optional.of(list.get(0));
    }

    @EntityGraph(attributePaths = {"artistMetadata"})
    @Query("SELECT a FROM Artist a WHERE LOWER(a.name) LIKE LOWER(CONCAT('%', :query, '%')) ORDER BY a.name ASC")
    List<Artist> searchByNameQuery(@Param("query") String query, Pageable pageable);

    default List<Artist> searchByName(String query, int limit) {
        if (query == null || query.isBlank()) return List.of();
        return searchByNameQuery(query.trim(), PageRequest.of(0, limit));
    }

    @EntityGraph(attributePaths = {"artistMetadata"})
    @Query("SELECT a FROM Artist a ORDER BY a.createdAt DESC")
    List<Artist> findAllPaginatedQuery(Pageable pageable);

    default List<Artist> findAllPaginated(int page, int size) {
        return findAllPaginatedQuery(PageRequest.of(page, size));
    }

    @EntityGraph(attributePaths = {"artistMetadata"})
    List<Artist> findByIdIn(List<String> ids);

    default List<Artist> findAllByIds(List<String> ids) {
        if (ids == null || ids.isEmpty()) return List.of();
        return findByIdIn(ids);
    }
}
