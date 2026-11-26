/**
 * Redis queue ke naam ek hi jagah.
 *
 * Ye naam in jagahon ki queue keys se MATCH hone chahiye:
 * - coreEngine: application.yaml (spring.data.redis.*)
 * - workers/mailEvents: process.env.MAIL_QUEUE
 *
 * Yahan naam badlo to is module ko import karne wale saare workers me badal jaata hai -
 * alag-alag jagah alag naam reh jaane wali chupi galti nahi hoti.
 */
export const QUEUES = {
  /** Upload aur transcoding jobs */
  AUDIO_PROCESSING: process.env.JOB_PROCESSING_QUEUE || "audio_processing_queue",

  /** Cloud se files hatane wali delete chain ke events */
  DELETE_EVENT: process.env.DELETE_EVENT_QUEUE || "delete_event_queue",

  /** Job cancel karne ke events */
  CANCEL_EVENT: process.env.CANCEL_EVENT_QUEUE || "audio_cancel_queue",
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];
