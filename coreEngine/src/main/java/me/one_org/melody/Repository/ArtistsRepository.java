package me.one_org.melody.Repository;

import me.one_org.melody.Entity.Artist;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ArtistsRepository extends JpaRepository<Artist, String> {

    @Query("SELECT a FROM Artist a WHERE LOWER(TRIM(a.name)) = LOWER(TRIM(:name))")
    List<Artist> findByNameIgnoreCaseList(@Param("name") String name, Pageable pageable);

    default Optional<Artist> findByNameIgnoreCase(String name) {
        if (name == null || name.isBlank()) return Optional.empty();
        List<Artist> list = findByNameIgnoreCaseList(name, PageRequest.of(0, 1));
        return list.isEmpty() ? Optional.empty() : Optional.of(list.get(0));
    }

    @Query("SELECT a FROM Artist a WHERE LOWER(a.name) LIKE LOWER(CONCAT('%', :query, '%')) ORDER BY a.name ASC")
    List<Artist> searchByNameQuery(@Param("query") String query, Pageable pageable);

    default List<Artist> searchByName(String query, int limit) {
        if (query == null || query.isBlank()) return List.of();
        return searchByNameQuery(query.trim(), PageRequest.of(0, limit));
    }

    @Query("SELECT a FROM Artist a ORDER BY a.createdAt DESC")
    List<Artist> findAllPaginatedQuery(Pageable pageable);

    default List<Artist> findAllPaginated(int page, int size) {
        return findAllPaginatedQuery(PageRequest.of(page, size));
    }

    @Query("SELECT a FROM Artist a WHERE a.id IN :ids")
    List<Artist> findAllByIdsQuery(@Param("ids") List<String> ids);

    default List<Artist> findAllByIds(List<String> ids) {
        if (ids == null || ids.isEmpty()) return List.of();
        return findAllByIdsQuery(ids);
    }
}
