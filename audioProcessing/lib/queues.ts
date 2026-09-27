/**
 * Centralized Redis queue name constants.
 *
 * These names MUST match the queue keys configured in:
 * - coreEngine: application.yaml (spring.data.redis.*)
 * - workers/mailEvents: process.env.MAIL_QUEUE
 *
 * Changing a queue name here will propagate to all workers
 * that import from this module, preventing silent mismatches.
 */
export const QUEUES = {
  /** Ingestion & transcoding jobs */
  AUDIO_PROCESSING: process.env.JOB_PROCESSING_QUEUE || "audio_processing_queue",

  /** Cloud resource deletion cascade events */
  DELETE_EVENT: process.env.DELETE_EVENT_QUEUE || "delete_event_queue",

  /** Job cancellation events */
  CANCEL_EVENT: process.env.CANCEL_EVENT_QUEUE || "audio_cancel_queue",
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];
