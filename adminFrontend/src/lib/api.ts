const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:9090";

export interface Song {
  id: string;
  title: string;
  artistName: string;
  duration: number;
  songKey: string;
  imageKey: string;
  videoKey?: string;
  fullVideoKey?: string;
  language: string;
  lrclibId: string;
  isFeatured?: boolean;
  status?: string;
  createdAt?: string;
}

export interface Artist {
  id: string;
  name: string;
  about?: string;
  dob?: string;
  coverImageKey?: string;
  status?: string;
  createdAt?: string;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  coverImageKey?: string;
  videoKey?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface User {
  id: string;
  name?: string | null;
  userName?: string | null;
  email: string;
  role: string;
  status?: string;
  createdAt?: string;
}

export type JobStage =
  | "QUEUED"
  | "TRANSCODING"
  | "RECOMMENDATION_INDEXING"
  | "SEARCH_INDEXING"
  | "FINALIZING"
  | "COMPLETED"
  | "FAILED";

export interface JobStageDetail {
  stageName: JobStage;
  label: string;
  status: "COMPLETED" | "IN_PROGRESS" | "PENDING" | "FAILED" | "SKIPPED";
  startedAt?: string | null;
  completedAt?: string | null;
  durationMs?: number | null;
  formattedDuration: string;
}

export interface JobProgress {
  id: string;
  title: string;
  artistName: string;
  songId: string;
  imageKey: string;
  videoKey?: string | null;
  fullVideoKey?: string | null;
  duration?: number | null;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  currentStage: JobStage;
  transcodingAttempt: number;
  isVideoReprocess?: boolean;
  createdAt?: string | null;
  transcodingStartedAt?: string | null;
  transcodedAt?: string | null;
  recommendationSavedAt?: string | null;
  searchSavedAt?: string | null;
  completedAt?: string | null;
  failedAt?: string | null;
  failureReason?: string | null;
  transcodingDurationMs?: number | null;
  recommendationDurationMs?: number | null;
  searchDurationMs?: number | null;
  finalizeDurationMs?: number | null;
  totalDurationMs?: number | null;
  elapsedTotalMs?: number | null;
  currentStageElapsedMs?: number | null;
  stages: JobStageDetail[];
}

export interface QueueItem {
  queueName: string;
  queueKey: string;
  size: number;
  backpressureStatus: "HEALTHY" | "ELEVATED" | "HIGH" | "ALERT";
  type: "STANDARD" | "DLQ";
  description: string;
  safeThreshold: number;
  highThreshold: number;
}

export interface QueueBackpressureSummary {
  totalQueued: number;
  overallStatus: "HEALTHY" | "MODERATE" | "HIGH" | "DLQ_ALERT";
  audioProcessingQueueSize: number;
  mailQueueSize: number;
  deleteQueueSize: number;
  mailDlqSize: number;
  queues: QueueItem[];
  timestamp?: string;
}

export interface JobSummaryMetrics {
  totalJobs: number;
  currentlyProcessing: number;
  pendingQueued: number;
  completed: number;
  failed: number;
  stageBreakdown: Record<string, number>;
  avgTranscodingMs?: number;
  avgRecommendationMs?: number;
  avgSearchMs?: number;
  avgFinalizeMs?: number;
  avgTotalMs?: number;
  queueBackpressure?: QueueBackpressureSummary;
}

export type DeleteJobStage =
  | "QUEUED"
  | "SEARCH_DELETED"
  | "RECOMMENDATION_DELETED"
  | "IMAGEKIT_DELETED"
  | "S3_DELETED"
  | "COMPLETED"
  | "FAILED";

export interface DeleteJobStageDetail {
  stageName: DeleteJobStage;
  label: string;
  status: "COMPLETED" | "IN_PROGRESS" | "PENDING" | "FAILED" | "SKIPPED";
  startedAt?: string | null;
  completedAt?: string | null;
  durationMs?: number | null;
  formattedDuration: string;
}

export interface DeleteJobProgress {
  id: string;
  entityType: "SONG" | "PLAYLIST" | "ARTIST";
  entityId: string;
  entityTitle?: string | null;
  songKey?: string | null;
  imageKey?: string | null;
  coverImageKey?: string | null;
  videoKey?: string | null;
  fullVideoKey?: string | null;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
  currentStage: DeleteJobStage;
  attemptCount: number;
  maxAttempts: number;
  createdAt?: string | null;
  startedAt?: string | null;
  searchDeletedAt?: string | null;
  recommendationDeletedAt?: string | null;
  imagekitDeletedAt?: string | null;
  s3DeletedAt?: string | null;
  completedAt?: string | null;
  failedAt?: string | null;
  failureReason?: string | null;
  searchDurationMs?: number | null;
  recommendationDurationMs?: number | null;
  imagekitDurationMs?: number | null;
  s3DurationMs?: number | null;
  finalizeDurationMs?: number | null;
  totalDurationMs?: number | null;
  elapsedTotalMs?: number | null;
  currentStageElapsedMs?: number | null;
  stages: DeleteJobStageDetail[];
}

export interface DeleteJobSummaryMetrics {
  totalJobs: number;
  currentlyProcessing: number;
  pendingQueued: number;
  completed: number;
  failed: number;
  stageBreakdown: Record<string, number>;
  avgSearchMs?: number;
  avgRecommendationMs?: number;
  avgImageKitMs?: number;
  avgS3Ms?: number;
  avgFinalizeMs?: number;
  avgTotalMs?: number;
  deleteQueueDepth?: number;
}

export interface Job {
  id: string;
  title: string;
  artistName: string;
  duration?: number;
  imageKey: string;
  songKey?: string;
  videoKey?: string;
  fullVideoKey?: string;
  clipStartSec?: number;
  clipEndSec?: number;
  previewStartTime?: number;
  previewEndTime?: number;
  language?: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  currentStage?: JobStage;
  transcodingAttempt?: number;
  isVideoReprocess?: boolean;
  createdAt?: string;
}

export interface DashboardStats {
  totalSongs: number;
  activeSongs: number;
  featuredSongs: number;
  totalArtists: number;
  activeArtists: number;
  totalPlaylists: number;
  activePlaylists: number;
  totalUsers: number;
  activeUsers: number;
  blockedUsers: number;
  totalJobs: number;
  pendingJobs: number;
  failedJobs: number;
  processingJobs: number;
  completedJobs: number;
  recentSongs: Song[];
  recentJobs: Job[];
  queueStats?: QueueBackpressureSummary;
}

export interface PaginatedResponse<T> {
  content: T[];
  page: number;
  size: number;
  paginationMetaData?: {
    entityName?: string;
    totalCount?: number;
    activeCount?: number;
    blockedCount?: number;
    deletedCount?: number;
  };
}

export const adminClient = {
  auth: {
    login: async (email: string) => {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: "password" }),
      });
      if (!res.ok) {
        let msg = "Login failed";
        try { const d = await res.json(); msg = d.message || msg; } catch {}
        throw new Error(msg);
      }
      const data = await res.json();
      return { data: { token: data.tempToken } };
    },
    register: async (name: string, email: string) => {
      const res = await fetch(`${API_BASE_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userName: name, email, password: "password" }),
      });
      if (!res.ok) {
        let msg = "Registration failed";
        try { const d = await res.json(); msg = d.message || msg; } catch {}
        throw new Error(msg);
      }
      const data = await res.json();
      return { data: { token: data.tempToken } };
    },
    verifyOtp: async (token: string, otp: string, email: string) => {
      // 1. Verify OTP with the real backend
      const verifyRes = await fetch(`${API_BASE_URL}/auth/verify-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-TEMP-TOKEN": token,
        },
        body: JSON.stringify({ otp }),
      });
      if (!verifyRes.ok) {
        let msg = "OTP verification failed";
        try { const d = await verifyRes.json(); msg = d.message || msg; } catch {}
        throw new Error(msg);
      }
      const verifyData = await verifyRes.json();
      const { accessToken, refreshToken } = verifyData;

      // 2. Fetch user profile with the real access token
      const profileRes = await fetch(`${API_BASE_URL}/api/user/profile`, {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
        },
      });

      let user: any = { id: "unknown", email, name: "Admin", role: "admin" };
      if (profileRes.ok) {
        const profile = await profileRes.json();
        user = {
          id: profile.id,
          email: profile.email,
          name: profile.userName || profile.name || "Admin",
          role: profile.role || "user",
        };
      }

      return {
        data: {
          accessToken,
          refreshToken,
          user,
        },
      };
    },
    resendOtp: async (token: string, email: string) => {
      const res = await fetch(`${API_BASE_URL}/auth/resend-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-TEMP-TOKEN": token,
        },
      });
      if (!res.ok) {
        let msg = "Failed to resend OTP";
        try { const d = await res.json(); msg = d.message || msg; } catch {}
        throw new Error(msg);
      }
      // resend-otp returns void (200), keep using the same token
      return { data: { token } };
    },
  },
};
