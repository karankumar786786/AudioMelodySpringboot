package me.one_org.melody.Aspects;

import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.reflect.MethodSignature;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.stereotype.Service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CentralizedLoggingAspectTest {

    @InjectMocks
    private CentralizedLoggingAspect loggingAspect;

    @Mock
    private ProceedingJoinPoint joinPoint;

    @Mock
    private MethodSignature methodSignature;

    @Service
    static class DummyService {
        public String execute(String username, String password) {
            return "ok";
        }
    }

    @BeforeEach
    void setUp() {
        when(joinPoint.getSignature()).thenReturn(methodSignature);
        doReturn(DummyService.class).when(methodSignature).getDeclaringType();
        when(methodSignature.getName()).thenReturn("execute");
    }

    @Test
    @DisplayName("Should successfully proceed and return result while masking sensitive arguments")
    void shouldLogAndProceedSuccessfully() throws Throwable {
        when(methodSignature.getParameterNames()).thenReturn(new String[]{"username", "password"});
        when(joinPoint.getArgs()).thenReturn(new Object[]{"john_doe", "superSecret123"});
        when(joinPoint.proceed()).thenReturn("result_success");

        Object result = loggingAspect.logMethodExecution(joinPoint);

        assertThat(result).isEqualTo("result_success");
        verify(joinPoint, times(1)).proceed();
    }

    @Test
    @DisplayName("Should log failure and rethrow exception on method failure")
    void shouldLogAndRethrowOnException() throws Throwable {
        when(methodSignature.getParameterNames()).thenReturn(new String[]{"username", "password"});
        when(joinPoint.getArgs()).thenReturn(new Object[]{"john_doe", "secret"});
        when(joinPoint.proceed()).thenThrow(new IllegalArgumentException("Invalid input argument"));

        assertThatThrownBy(() -> loggingAspect.logMethodExecution(joinPoint))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Invalid input argument");

        verify(joinPoint, times(1)).proceed();
    }
}
