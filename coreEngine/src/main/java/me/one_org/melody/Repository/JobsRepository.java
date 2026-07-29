package me.one_org.melody.Repository;

import me.one_org.melody.Entity.Jobs;
import org.springframework.data.jpa.repository.JpaRepository;

public interface JobsRepository extends JpaRepository<Jobs, String> {
}
