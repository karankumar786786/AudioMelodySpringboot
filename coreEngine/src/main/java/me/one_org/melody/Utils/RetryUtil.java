package me.one_org.melody.Utils;

import org.slf4j.Logger;

/**
 * Kisi kaam ko fail hone par dobara try karne ka helper (retry with exponential backoff).
 *
 * Exponential backoff = har fail ke baad wait time double: 200ms, 400ms, 800ms...
 * (max 10 second). Isse thoda down hua external service (Recombee, Algolia) sambhal
 * leta hai, aur hum use lagataar requests se pareshan bhi nahi karte.
 */
public final class RetryUtil {

    private RetryUtil() {}

    /** Jo kaam retry karna hai - ek lambda jo exception phenk sakta hai. */
    @FunctionalInterface
    public interface RetryableAction {
        void execute() throws Exception;
    }

    /**
     * Action ko maxAttempts baar tak chalata hai.
     * Saare tries fail ho jaayein to sirf warning log karta hai, exception aage NAHI phenkta -
     * yaani caller ka kaam rukta nahi.
     *
     * @param action jo kaam karna hai
     * @param maxAttempts total kitni baar try karna hai
     * @param initialDelayMs pehle retry se pehle kitne ms rukna hai
     * @param actionDescription log me dikhane ke liye kaam ka naam
     * @param log logger (null ho sakta hai)
     */
    public static void executeWithRetry(
            RetryableAction action,
            int maxAttempts,
            long initialDelayMs,
            String actionDescription,
            Logger log) {
        int attempt = 0;
        long delay = initialDelayMs;

        while (attempt < maxAttempts) {
            attempt++;
            try {
                action.execute();
                return;
            } catch (Exception e) {
                if (attempt >= maxAttempts) {
                    if (log != null) {
                        log.warn("Action [{}] permanently failed after {} attempts: {}", actionDescription, maxAttempts, e.getMessage());
                    }
                    break;
                }
                if (log != null) {
                    log.debug("Action [{}] failed (attempt {}/{}), retrying in {}ms: {}", actionDescription, attempt, maxAttempts, delay, e.getMessage());
                }
                try {
                    Thread.sleep(delay);
                } catch (InterruptedException ie) {
                    // Thread ko rokne ka signal aaya - flag wapas set karke retry band kar do.
                    Thread.currentThread().interrupt();
                    if (log != null) {
                        log.warn("Action [{}] retry interrupted", actionDescription);
                    }
                    break;
                }
                delay = Math.min(delay * 2, 10_000L); // wait double karo, par 10 sec se zyada nahi
            }
        }
    }
}
