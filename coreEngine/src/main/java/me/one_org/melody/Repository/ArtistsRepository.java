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

/**
 * Table artists ke liye queries.
 *
 * Repository = database se baat karne wali layer. Spring Data JPA in interfaces ka code khud bana deta hai:
 * method ka naam (findByEmail) ya @Query likho, SQL Spring chala dega.
 * @EntityGraph = related data (jaise songMetadata) ek hi query me saath laao, alag query (N+1 problem) se bacho.
 * @Modifying = ye query data badalti hai (UPDATE/DELETE), sirf padhti nahi.
 */
public interface ArtistsRepository extends JpaRepository<Artist, String> {

    /** Id se artist, followers count ke saath. */
    @Override
    @EntityGraph(attributePaths = {"artistMetadata"})
    Optional<Artist> findById(String id);

    /** Naam se artist (chhote-bade akshar aur aage-peeche ke space ignore). */
    @EntityGraph(attributePaths = {"artistMetadata"})
    @Query("SELECT a FROM Artist a WHERE LOWER(TRIM(a.name)) = LOWER(TRIM(:name))")
    List<Artist> findByNameIgnoreCaseList(@Param("name") String name, Pageable pageable);

    /** Naam se pehla matching artist. */
    default Optional<Artist> findByNameIgnoreCase(String name) {
        if (name == null || name.isBlank()) return Optional.empty();
        List<Artist> list = findByNameIgnoreCaseList(name, PageRequest.of(0, 1));
        return list.isEmpty() ? Optional.empty() : Optional.of(list.get(0));
    }

    /** Naam me ye text kahin bhi ho (LIKE %query%), A-Z order me. */
    @EntityGraph(attributePaths = {"artistMetadata"})
    @Query("SELECT a FROM Artist a WHERE LOWER(a.name) LIKE LOWER(CONCAT('%', :query, '%')) ORDER BY a.name ASC")
    List<Artist> searchByNameQuery(@Param("query") String query, Pageable pageable);

    /** Search, zyada se zyada limit results. Khaali query pe khaali list. */
    default List<Artist> searchByName(String query, int limit) {
        if (query == null || query.isBlank()) return List.of();
        return searchByNameQuery(query.trim(), PageRequest.of(0, limit));
    }

    /** Saare artists - sabse zyada followers wale pehle. */
    @EntityGraph(attributePaths = {"artistMetadata"})
    @Query("SELECT a FROM Artist a LEFT JOIN a.artistMetadata m ORDER BY COALESCE(m.followersCount, 0L) DESC, a.createdAt DESC")
    List<Artist> findAllPaginatedQuery(Pageable pageable);

    /** Page number aur size se artists ki list. */
    default List<Artist> findAllPaginated(int page, int size) {
        return findAllPaginatedQuery(PageRequest.of(page, size));
    }

    /** In ids wale saare artists ek query me. */
    @EntityGraph(attributePaths = {"artistMetadata"})
    List<Artist> findByIdIn(List<String> ids);

    /** Ids ki list se artists; khaali list pe query hi mat chalao. */
    default List<Artist> findAllByIds(List<String> ids) {
        if (ids == null || ids.isEmpty()) return List.of();
        return findByIdIn(ids);
    }
}
