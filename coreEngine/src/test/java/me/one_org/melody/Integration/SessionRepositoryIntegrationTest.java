package me.one_org.melody.Integration;

import java.time.LocalDateTime;
import java.util.Optional;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import me.one_org.melody.Entity.Session;
import me.one_org.melody.Entity.User;
import me.one_org.melody.Enums.StatusEnum;
import me.one_org.melody.Repository.SessionRepository;
import me.one_org.melody.Repository.UsersRepository;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class SessionRepositoryIntegrationTest {

    @Autowired
    private SessionRepository sessionRepository;

    @Autowired
    private UsersRepository usersRepository;

    @Test
    @DisplayName("Should save, find and update session by userId and deviceId")
    void shouldSaveAndFindSession() {
        User user = User.builder()
                .id("sess-user-1")
                .userName("SessionTester")
                .email("session@melody.io")
                .status(StatusEnum.ACTIVE)
                .build();
        usersRepository.saveAndFlush(user);

        Session session = Session.builder()
                .id("sess-1")
                .user(user)
                .deviceId("mobile-ios-1")
                .refreshToken("rt-initial-token-123")
                .expiresAt(LocalDateTime.now().plusDays(7))
                .build();
        sessionRepository.saveAndFlush(session);

        Optional<Session> found = sessionRepository.findByUserIdAndDeviceId("sess-user-1", "mobile-ios-1");
        assertThat(found).isPresent();
        assertThat(found.get().getRefreshToken()).isEqualTo("rt-initial-token-123");
        assertThat(found.get().getDeviceId()).isEqualTo("mobile-ios-1");

        // Rotate refresh token
        found.get().setRefreshToken("rt-rotated-token-456");
        sessionRepository.saveAndFlush(found.get());

        Optional<Session> rotated = sessionRepository.findByRefreshToken("rt-rotated-token-456");
        assertThat(rotated).isPresent();
        assertThat(rotated.get().getId()).isEqualTo("sess-1");
    }

    @Test
    @DisplayName("Should delete session by userId and deviceId upon logout")
    void shouldDeleteSessionOnLogout() {
        User user = User.builder()
                .id("sess-user-2")
                .userName("LogoutUser")
                .email("logout@melody.io")
                .status(StatusEnum.ACTIVE)
                .build();
        usersRepository.saveAndFlush(user);

        Session session = Session.builder()
                .id("sess-2")
                .user(user)
                .deviceId("web-chrome-1")
                .refreshToken("rt-logout-token")
                .expiresAt(LocalDateTime.now().plusDays(7))
                .build();
        sessionRepository.saveAndFlush(session);

        sessionRepository.deleteByUserIdAndDeviceId("sess-user-2", "web-chrome-1");

        Optional<Session> deleted = sessionRepository.findByUserIdAndDeviceId("sess-user-2", "web-chrome-1");
        assertThat(deleted).isEmpty();
    }
}
