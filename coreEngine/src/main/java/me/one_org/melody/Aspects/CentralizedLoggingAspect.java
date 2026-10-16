package me.one_org.melody.Aspects;

import java.util.Set;

import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Pointcut;
import org.aspectj.lang.reflect.MethodSignature;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Centralized AOP Aspect that handles logging across Controllers, Services,
 * and Event Listeners. Replaces repetitive, scattered manual logging statements
 * with structured, uniform entry/exit/timing/failure logs.
 */
@Aspect
@Component
public class CentralizedLoggingAspect {

    private static final Logger log = LoggerFactory.getLogger(CentralizedLoggingAspect.class);

    private static final Set<String> SENSITIVE_KEYWORDS = Set.of(
            "password", "token", "secret", "authorization", "apikey", "jwt",
            "otp", "accesstoken", "refreshtoken", "credential", "auth"
    );

    // ── Pointcuts ──

    @Pointcut("within(@org.springframework.web.bind.annotation.RestController *) || within(@org.springframework.stereotype.Controller *)")
    public void controllerLayer() {}

    @Pointcut("within(@org.springframework.stereotype.Service *)")
    public void serviceLayer() {}

    @Pointcut("execution(* me.one_org.melody.Events..*.*(..))")
    public void eventLayer() {}

    @Pointcut("controllerLayer() || serviceLayer() || eventLayer()")
    public void applicationLayers() {}

    @Pointcut("@annotation(me.one_org.melody.Aspects.NoLogging) || @within(me.one_org.melody.Aspects.NoLogging)")
    public void excludedFromLogging() {}

    // ── Around Advice ──

    @Around("applicationLayers() && !excludedFromLogging()")
    public Object logMethodExecution(ProceedingJoinPoint joinPoint) throws Throwable {
        MethodSignature signature = (MethodSignature) joinPoint.getSignature();
        String className = signature.getDeclaringType().getSimpleName();
        String methodName = signature.getName();
        String targetIdentifier = className + "." + methodName;

        String layerType = determineLayer(signature.getDeclaringType());
        String safeArgs = formatSafeArguments(signature.getParameterNames(), joinPoint.getArgs());

        if (log.isDebugEnabled()) {
            log.debug("[{}:START] {} with args: {}", layerType, targetIdentifier, safeArgs);
        } else {
            log.info("[{}:START] {}", layerType, targetIdentifier);
        }

        long startTime = System.currentTimeMillis();
        try {
            Object result = joinPoint.proceed();
            long executionTime = System.currentTimeMillis() - startTime;

            if (executionTime > 1000) {
                log.warn("[{}:SLOW] {} completed in {} ms (exceeded 1s threshold)", layerType, targetIdentifier, executionTime);
            } else {
                log.info("[{}:SUCCESS] {} completed in {} ms", layerType, targetIdentifier, executionTime);
            }
            return result;
        } catch (Throwable ex) {
            long executionTime = System.currentTimeMillis() - startTime;
            log.error("[{}:FAILURE] {} failed after {} ms: {} - {}",
                    layerType, targetIdentifier, executionTime, ex.getClass().getSimpleName(), ex.getMessage());
            throw ex;
        }
    }

    private String determineLayer(Class<?> declaringType) {
        if (declaringType.isAnnotationPresent(org.springframework.web.bind.annotation.RestController.class) ||
            declaringType.isAnnotationPresent(org.springframework.stereotype.Controller.class)) {
            return "CONTROLLER";
        }
        if (declaringType.isAnnotationPresent(org.springframework.stereotype.Service.class)) {
            return "SERVICE";
        }
        if (declaringType.getPackageName().contains(".Events")) {
            return "EVENT";
        }
        return "CORE";
    }

    private String formatSafeArguments(String[] paramNames, Object[] args) {
        if (args == null || args.length == 0) {
            return "[]";
        }
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < args.length; i++) {
            if (i > 0) sb.append(", ");
            String paramName = (paramNames != null && i < paramNames.length) ? paramNames[i] : "arg" + i;
            Object arg = args[i];

            if (isSensitive(paramName)) {
                sb.append(paramName).append("=[PROTECTED]");
            } else if (arg == null) {
                sb.append(paramName).append("=null");
            } else if (arg instanceof String s) {
                sb.append(paramName).append("=\"").append(sanitizeString(s)).append("\"");
            } else if (isPrimitiveOrBoxed(arg.getClass())) {
                sb.append(paramName).append("=").append(arg);
            } else {
                sb.append(paramName).append("=").append(arg.getClass().getSimpleName());
            }
        }
        sb.append("]");
        return sb.toString();
    }

    private boolean isSensitive(String name) {
        if (name == null) return false;
        String lower = name.toLowerCase();
        for (String keyword : SENSITIVE_KEYWORDS) {
            if (lower.contains(keyword)) {
                return true;
            }
        }
        return false;
    }

    private String sanitizeString(String s) {
        if (s == null) return "";
        if (s.length() > 60) {
            return s.substring(0, 57) + "...";
        }
        return s;
    }

    private boolean isPrimitiveOrBoxed(Class<?> clazz) {
        return clazz.isPrimitive() ||
               Number.class.isAssignableFrom(clazz) ||
               Boolean.class.isAssignableFrom(clazz) ||
               Character.class.isAssignableFrom(clazz);
    }
}
