package me.one_org.melody.Services.App;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import me.one_org.melody.Entity.SongsEntity;
import me.one_org.melody.Repository.SongsRepository;

@Service
public class SongsAppService {

    private final SongsRepository songsRepository;

    public SongsAppService(SongsRepository songsRepository) {
        this.songsRepository = songsRepository;
    }

    public List<SongsEntity> browseSongs(int page, int size) {
        return songsRepository.findAllPaginated(page, size);
    }

    public SongsEntity getSongById(String id) {
        return songsRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Song not found"));
    }

    public long getTotalSongs() {
        return songsRepository.count();
    }
}
