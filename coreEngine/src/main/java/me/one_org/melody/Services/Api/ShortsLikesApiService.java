package me.one_org.melody.Services.Api;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import lombok.extern.slf4j.Slf4j;
import me.one_org.melody.Dto.Controllers.PaginatedResponseDto;
import me.one_org.melody.Dto.Controllers.Api.PaginationMetaDataDto;
import me.one_org.melody.Dto.Controllers.Api.ShortsLikeStatusDto;
import me.one_org.melody.Dto.Controllers.Api.SongDto;
import me.one_org.melody.Entity.Song;
import me.one_org.melody.Entity.User;
import me.one_org.melody.Entity.UserShortsLike;
import me.one_org.melody.Exceptions.ResourceNotFoundException;
import me.one_org.melody.Repository.SongsRepository;
import me.one_org.melody.Repository.UserShortsLikeRepository;
import me.one_org.melody.Repository.UsersRepository;

@Service
@Transactional
@Slf4j
public class ShortsLikesApiService {

    private final UserShortsLikeRepository shortsLikeRepository;
    private final SongsRepository songsRepository;
    private final UsersRepository usersRepository;

    public ShortsLikesApiService(
            UserShortsLikeRepository shortsLikeRepository,
            SongsRepository songsRepository,
            UsersRepository usersRepository
    ) {
        this.shortsLikeRepository = shortsLikeRepository;
        this.songsRepository = songsRepository;
        this.usersRepository = usersRepository;
    }

    public ShortsLikeStatusDto toggleLike(String userId, String songId) {
        if (userId == null || userId.isBlank() || songId == null || songId.isBlank()) {
            throw new IllegalArgumentException("userId and songId must not be blank");
        }

        Song song = songsRepository.findById(songId)
                .orElseThrow(() -> new ResourceNotFoundException("Song not found: " + songId));

        boolean exists = shortsLikeRepository.existsByUserIdAndSongId(userId, songId);
        boolean newLikedState;

        if (exists) {
            shortsLikeRepository.deleteByUserIdAndSongId(userId, songId);
            newLikedState = false;
            log.debug("[ShortsLike] User [{}] unliked short [{}]", userId, songId);
        } else {
            User user = usersRepository.findById(userId)
                    .orElseThrow(() -> new ResourceNotFoundException("User not found: " + userId));

            UserShortsLike like = UserShortsLike.builder()
                    .user(user)
                    .song(song)
                    .build();
            shortsLikeRepository.save(like);
            newLikedState = true;
            log.debug("[ShortsLike] User [{}] liked short [{}]", userId, songId);
        }

        long totalCount = shortsLikeRepository.countBySongId(songId);
        return new ShortsLikeStatusDto(songId, newLikedState, totalCount);
    }

    @Transactional(readOnly = true)
    public ShortsLikeStatusDto getLikeStatus(String userId, String songId) {
        if (songId == null || songId.isBlank()) {
            return new ShortsLikeStatusDto("", false, 0L);
        }

        boolean liked = (userId != null && !userId.isBlank()) &&
                shortsLikeRepository.existsByUserIdAndSongId(userId, songId);
        long count = shortsLikeRepository.countBySongId(songId);

        return new ShortsLikeStatusDto(songId, liked, count);
    }

    @Transactional(readOnly = true)
    public List<String> getLikedSongIds(String userId) {
        if (userId == null || userId.isBlank()) {
            return Collections.emptyList();
        }
        return shortsLikeRepository.findLikedSongIdsByUserId(userId);
    }

    @Transactional(readOnly = true)
    public PaginatedResponseDto<SongDto> getLikedShortSongs(String userId, int page, int size) {
        if (userId == null || userId.isBlank()) {
            return PaginatedResponseDto.empty(page, size);
        }
        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(50, size));
        Page<Song> songsPage = shortsLikeRepository.findLikedSongsByUserId(userId, PageRequest.of(safePage, safeSize));

        List<SongDto> dtos = songsPage.getContent().stream()
                .map(s -> SongDto.fromEntity(s, true, shortsLikeRepository.countBySongId(s.getId())))
                .toList();

        PaginationMetaDataDto meta = new PaginationMetaDataDto(
                "liked_shorts",
                "songs",
                songsPage.getTotalElements(),
                songsPage.getTotalElements(),
                0L,
                0L,
                LocalDateTime.now()
        );

        return new PaginatedResponseDto<>(dtos, safePage, safeSize, meta);
    }
}

