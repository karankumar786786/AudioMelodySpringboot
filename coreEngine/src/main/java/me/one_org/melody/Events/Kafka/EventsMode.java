package me.one_org.melody.Events.Kafka;

/**
 * How the core API handles telemetry and state-change events.
 * <ul>
 *   <li>LEGACY: today's path only (in-process listeners, Redis mail queue). No Kafka.</li>
 *   <li>DUAL: legacy path stays authoritative and events are also sent to Kafka, so the
 *       stream services can be compared against it. Kafka failures never fail a request.</li>
 *   <li>KAFKA: events go to Kafka only; the stream services do the work. Telemetry
 *       answers 503 when Kafka can't take the event, so the app keeps it and retries.</li>
 * </ul>
 */
public enum EventsMode {
    LEGACY, DUAL, KAFKA;

    public boolean producesEvents() {
        return this != LEGACY;
    }

    public boolean runsLegacyPath() {
        return this != KAFKA;
    }
}
