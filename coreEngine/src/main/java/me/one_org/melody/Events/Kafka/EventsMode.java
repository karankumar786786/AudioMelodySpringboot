package me.one_org.melody.Events.Kafka;

/**
 * Core API events (telemetry, state changes) ko kaise sambhalta hai - env var EVENTS_MODE se.
 * <ul>
 *   <li>LEGACY: sirf purana raasta (andar ke listeners, Redis mail queue). Kafka bilkul nahi.</li>
 *   <li>DUAL: purana raasta hi asli hai, saath me events Kafka pe bhi jaate hain - taaki naye
 *       stream processors ka result purane se compare kar sakein. Kafka fail ho to bhi request fail nahi.</li>
 *   <li>KAFKA: events sirf Kafka pe; saara kaam stream processors karte hain. Kafka event na le
 *       paaye to telemetry 503 deti hai, aur app event rakh ke baad me retry karta hai.</li>
 * </ul>
 * Ye teen steps isliye hain taaki Kafka pe dheere dheere, safely shift kar sakein.
 */
public enum EventsMode {
    LEGACY, DUAL, KAFKA;

    /** Kafka pe events bhejne hain? (DUAL ya KAFKA) */
    public boolean producesEvents() {
        return this != LEGACY;
    }

    /** Purana andar wala raasta chalana hai? (LEGACY ya DUAL) */
    public boolean runsLegacyPath() {
        return this != KAFKA;
    }
}
