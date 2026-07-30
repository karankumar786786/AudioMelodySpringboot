package me.one_org.melody.Services.Admin;


import org.springframework.stereotype.Service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import me.one_org.melody.Dto.Controllers.Admin.CreateSongRequestDto;
import me.one_org.melody.Dto.Controllers.Admin.CreateSongResponseDto;

@Service
public class SongService {

    @PersistenceContext
    private EntityManager entityManager;


    public CreateSongResponseDto createSong(CreateSongRequestDto data){
        return null;
    }
    
}
