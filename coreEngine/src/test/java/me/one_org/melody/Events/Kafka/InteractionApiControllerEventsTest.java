package me.one_org.melody.Events.Kafka;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import me.one_org.melody.Controllers.Api.InteractionApiController;
import me.one_org.melody.Exceptions.GlobalExceptionHandler;
import me.one_org.melody.Services.Api.InteractionApiService;
import me.one_org.melody.Utils.CurrentUserTestArgumentResolver;

/**
 * Unit test: InteractionApiControllerEvents ko akele check karta hai (dependencies Mockito se nakli (mock) hain, taaki sirf isi class ka logic test ho).
 * Har @Test method ek behaviour check karta hai - method ka naam batata hai kya.
 */
class InteractionApiControllerEventsTest {

    private final InteractionApiService service = mock(InteractionApiService.class);
    private final TelemetryProducer telemetry = mock(TelemetryProducer.class);

    private MockMvc mvc(EventsMode mode) {
        EventsProperties props = new EventsProperties(mode, null, null, 0, 0, null, 0, null);
        InteractionApiController controller =
                new InteractionApiController(service, telemetry, new TelemetryRateLimiter(props), props);
        return MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .setCustomArgumentResolvers(new CurrentUserTestArgumentResolver())
                .build();
    }

    private static final String PLAY = "{\"songId\":\"song-1\",\"percentage\":0.85,\"durationMs\":180000}";

    @Test
    void kafkaModeOnlySendsTheEventAndAnswers202() throws Exception {
        mvc(EventsMode.KAFKA).perform(post("/api/interaction/play").requestAttr("userId", "u-1")
                        .contentType(MediaType.APPLICATION_JSON).content(PLAY))
                .andExpect(status().isAccepted());

        verify(telemetry).play(org.mockito.ArgumentMatchers.eq("u-1"), org.mockito.ArgumentMatchers.eq("song-1"), org.mockito.ArgumentMatchers.eq(0.85), org.mockito.ArgumentMatchers.eq(180000L), any(ListenDetail.class));
        verify(service, never()).trackPlay(anyString(), anyString(), anyDouble());
    }

    @Test
    void dualModeSendsTheEventAndKeepsTheLegacyPath() throws Exception {
        mvc(EventsMode.DUAL).perform(post("/api/interaction/play").requestAttr("userId", "u-1")
                        .contentType(MediaType.APPLICATION_JSON).content(PLAY))
                .andExpect(status().isOk());

        verify(telemetry).play(org.mockito.ArgumentMatchers.eq("u-1"), org.mockito.ArgumentMatchers.eq("song-1"), org.mockito.ArgumentMatchers.eq(0.85), org.mockito.ArgumentMatchers.eq(180000L), any(ListenDetail.class));
        verify(service).trackPlay("u-1", "song-1", 0.85);
    }

    @Test
    void kafkaOutageAnswers503SoTheAppRetries() throws Exception {
        org.mockito.Mockito.doThrow(new EventsUnavailableException("down", null))
                .when(telemetry).skip("u-1", "song-1", null);

        mvc(EventsMode.KAFKA).perform(post("/api/interaction/skip").requestAttr("userId", "u-1")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"songId\":\"song-1\"}"))
                .andExpect(status().isServiceUnavailable());
    }

    @Test
    void batchIsAcceptedInKafkaMode() throws Exception {
        when(telemetry.batch(anyString(), any())).thenReturn(2);

        mvc(EventsMode.KAFKA).perform(post("/api/interaction/batch").requestAttr("userId", "u-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"events\":[{\"type\":\"play\",\"songId\":\"s1\",\"percentage\":1.0},{\"type\":\"skip\",\"songId\":\"s2\"}]}"))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.accepted").value(2));
    }

    @Test
    void batchIsNotAvailableInLegacyMode() throws Exception {
        mvc(EventsMode.LEGACY).perform(post("/api/interaction/batch").requestAttr("userId", "u-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"events\":[{\"type\":\"skip\",\"songId\":\"s2\"}]}"))
                .andExpect(status().isNotFound());
    }
}
