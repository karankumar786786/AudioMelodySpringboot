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
 * Ek jagah se poore app ki logging (AOP = Aspect Oriented Programming).
 *
 * Har controller, service aur Events package ke method ke "aas paas" ye code
 * apne aap chalta hai: method shuru hua (START), kitne ms me khatam hua (SUCCESS),
 * 1 second se zyada laga to SLOW warning, aur exception aaya to FAILURE log.
 * Isse har method me khud log.info likhne ki zaroorat nahi padti.
 *
 * Password, token, OTP jaise sensitive parameters kabhi log nahi hote - unki
 * jagah "[PROTECTED]" likha jaata hai.
 * Kisi method / class ko is logging se bahar rakhna ho to us pe @NoLogging laga do.
 */
@Aspect
@Component
public class CentralizedLoggingAspect {

    private static final Logger log = LoggerFactory.getLogger(CentralizedLoggingAspect.class);

    // Inme se koi bhi shabd parameter ke naam me ho to uski value log nahi karenge.
    private static final Set<String> SENSITIVE_KEYWORDS = Set.of(
            "password", "token", "secret", "authorization", "apikey", "jwt",
            "otp", "accesstoken", "refreshtoken", "credential", "auth"
    );

    // ── Pointcuts: kin methods pe ye logging lagegi ──
    // (Pointcut = ek "filter" jo batata hai ki kaunse methods ko pakadna hai.)

    /** Saare @RestController / @Controller classes ke methods. */
    @Pointcut("within(@org.springframework.web.bind.annotation.RestController *) || within(@org.springframework.stereotype.Controller *)")
    public void controllerLayer() {}

    /** Saare @Service classes ke methods. */
    @Pointcut("within(@org.springframework.stereotype.Service *)")
    public void serviceLayer() {}

    /** Events package (aur uske sub-packages) ke saare methods. */
    @Pointcut("execution(* me.one_org.melody.Events..*.*(..))")
    public void eventLayer() {}

    /** Upar ke teeno layers ek saath. */
    @Pointcut("controllerLayer() || serviceLayer() || eventLayer()")
    public void applicationLayers() {}

    /** Jin methods ya classes pe @NoLogging laga hai. */
    @Pointcut("@annotation(me.one_org.melody.Aspects.NoLogging) || @within(me.one_org.melody.Aspects.NoLogging)")
    public void excludedFromLogging() {}

    // ── Around advice: asli kaam yahan hota hai ──

    /**
     * Method ke chalne se pehle aur baad me log likhta hai.
     * joinPoint.proceed() = "ab asli method chalao". Uska result wapas return karte hain,
     * aur exception aaye to log karke wahi exception aage phenk dete hain (behaviour same rehta hai).
     */
    @Around("applicationLayers() && !excludedFromLogging()")
    public Object logMethodExecution(ProceedingJoinPoint joinPoint) throws Throwable {
        MethodSignature signature = (MethodSignature) joinPoint.getSignature();
        String className = signature.getDeclaringType().getSimpleName();
        String methodName = signature.getName();
        String targetIdentifier = className + "." + methodName;

        String layerType = determineLayer(signature.getDeclaringType());
        String safeArgs = formatSafeArguments(signature.getParameterNames(), joinPoint.getArgs());

        // DEBUG mode me arguments bhi dikhao, warna sirf method ka naam.
        if (log.isDebugEnabled()) {
            log.debug("[{}:START] {} with args: {}", layerType, targetIdentifier, safeArgs);
        } else {
            log.info("[{}:START] {}", layerType, targetIdentifier);
        }

        long startTime = System.currentTimeMillis();
        try {
            Object result = joinPoint.proceed();
            long executionTime = System.currentTimeMillis() - startTime;

            // 1 second se zyada laga to SLOW warning, taaki slow APIs jaldi pakad me aayein.
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

    /** Class kis layer ki hai (CONTROLLER / SERVICE / EVENT / CORE) - sirf log me dikhane ke liye. */
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

    /**
     * Method ke arguments ko log ke liye safe string banata hai, jaise: [songId="abc", page=0].
     * Sensitive naam wale args chhupa dete hain, lambi strings kaat dete hain,
     * aur bade objects ka sirf class naam likhte hain (poora object nahi).
     */
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

    /** Parameter ka naam sensitive hai? (password, token, otp...) */
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

    /** 60 characters se lambi string ko chhota karke "..." laga deta hai. */
    private String sanitizeString(String s) {
        if (s == null) return "";
        if (s.length() > 60) {
            return s.substring(0, 57) + "...";
        }
        return s;
    }

    /** int, long, Integer, Boolean jaisi simple value hai? Inko seedha print kar sakte hain. */
    private boolean isPrimitiveOrBoxed(Class<?> clazz) {
        return clazz.isPrimitive() ||
               Number.class.isAssignableFrom(clazz) ||
               Boolean.class.isAssignableFrom(clazz) ||
               Character.class.isAssignableFrom(clazz);
    }
}
