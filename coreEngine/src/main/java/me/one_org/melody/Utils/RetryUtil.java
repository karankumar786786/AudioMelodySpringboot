package me.one_org.melody.Utils;

import org.slf4j.Logger;

/**
 * Utility for executing operations with exponential backoff retries.
 */
public final class RetryUtil {

    private RetryUtil() {}

    @FunctionalInterface
    public interface RetryableAction {
        void execute() throws Exception;
    }

    /**
     * Executes the given action with exponential backoff retries.
     *
     * @param action the action to execute
     * @param maxAttempts maximum number of attempts
     * @param initialDelayMs initial backoff delay in milliseconds
     * @param actionDescription human-readable description for logging
     * @param log logger instance
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
                    Thread.currentThread().interrupt();
                    if (log != null) {
                        log.warn("Action [{}] retry interrupted", actionDescription);
                    }
                    break;
                }
                delay = Math.min(delay * 2, 10_000L);
            }
        }
    }
}
