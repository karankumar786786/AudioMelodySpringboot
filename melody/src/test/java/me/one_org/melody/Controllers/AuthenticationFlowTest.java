package me.one_org.melody.Controllers;

import com.fasterxml.jackson.databind.ObjectMapper;
import me.one_org.melody.Dto.RegisterRequestDto;
import me.one_org.melody.Dto.VerifyOtpRequest;
import me.one_org.melody.Dto.RegisterUserCacheDto;
import me.one_org.melody.Redis.Redis;
import me.one_org.melody.Repository.UsersRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
public class AuthenticationFlowTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private Redis redis;

    @Autowired
    private UsersRepository usersRepository;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private final String testEmail = "flowtest@melody.com";
    private final String testUserName = "flowuser";

    @BeforeEach
    public void setup() {
        if (usersRepository.existsByEmail(testEmail)) {
            usersRepository.findAll().stream()
                    .filter(u -> testEmail.equalsIgnoreCase(u.getEmail()))
                    .forEach(u -> usersRepository.delete(u));
        }
    }

    @Test
    public void testFullOtpRegistrationFlowWithResend() throws Exception {
        RegisterRequestDto regDto = new RegisterRequestDto(testUserName, testEmail);

        // 1. Call Register
        MvcResult regResult = mockMvc.perform(post("/api/v1/Authentication/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(regDto)))
                .andExpect(status().isCreated())
                .andReturn();

        String tempToken = regResult.getResponse().getContentAsString();
        assertNotNull(tempToken);
        assertTrue(tempToken.contains(":"));

        // 2. Fetch the cached registration details from Redis to get the generated OTP
        Object cachedObj = redis.get(tempToken);
        assertNotNull(cachedObj);
        
        RegisterUserCacheDto cacheDto = objectMapper.convertValue(cachedObj, RegisterUserCacheDto.class);
        String firstOtp = cacheDto.otp();
        assertNotNull(firstOtp);

        // 3. Call Resend OTP
        mockMvc.perform(post("/api/v1/Authentication/resend-otp")
                        .header("X-TEMP-TOKEN", tempToken))
                .andExpect(status().isOk());

        // 4. Fetch the updated cached registration details
        Object updatedCachedObj = redis.get(tempToken);
        assertNotNull(updatedCachedObj);
        RegisterUserCacheDto updatedCacheDto = objectMapper.convertValue(updatedCachedObj, RegisterUserCacheDto.class);
        String secondOtp = updatedCacheDto.otp();
        assertNotNull(secondOtp);

        // 5. Call Verify OTP with incorrect OTP -> Should fail with 400
        VerifyOtpRequest wrongOtpReq = new VerifyOtpRequest("000000");
        mockMvc.perform(post("/api/v1/Authentication/verify-otp")
                        .header("X-TEMP-TOKEN", tempToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(wrongOtpReq)))
                .andExpect(status().isBadRequest());

        // 6. Call Verify OTP with the new/second OTP -> Should succeed and return JWT tokens
        VerifyOtpRequest correctOtpReq = new VerifyOtpRequest(secondOtp);
        MvcResult verifyResult = mockMvc.perform(post("/api/v1/Authentication/verify-otp")
                        .header("X-TEMP-TOKEN", tempToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(correctOtpReq)))
                .andExpect(status().isOk())
                .andReturn();

        String responseJson = verifyResult.getResponse().getContentAsString();
        assertTrue(responseJson.contains("accessToken"));
        assertTrue(responseJson.contains("refreshToken"));

        // 7. Verify user is saved in DB
        assertTrue(usersRepository.existsByEmail(testEmail));

        // 8. Redis key should be cleaned up
        assertFalse(redis.hasKey(tempToken));
    }
}
