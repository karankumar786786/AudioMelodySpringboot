import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { musicApi } from "@/lib/api";
import type { SaveSearchHistoryPayload, UserSession } from "@/lib/api/types";
import { useAppDispatch } from "@/store/hooks";
import { updateSystemUser } from "@/store/slices/authSlice";
import { queryKeys } from "./queryKeys";

export function useUserProfile() {
  return useQuery({
    queryKey: queryKeys.user.profile(),
    queryFn: async () => {
      const res = await musicApi.auth.getProfile();
      return res || null;
    },
    staleTime: 1000 * 60 * 10,
  });
}

export function useUserSessions() {
  return useQuery({
    queryKey: queryKeys.user.sessions(),
    queryFn: async () => {
      const res = await musicApi.users.getSessions();
      return (res as UserSession[]) || [];
    },
    staleTime: 1000 * 60 * 2,
  });
}

export function useSessionStatus() {
  return useQuery({
    queryKey: queryKeys.user.sessionStatus(),
    queryFn: async () => {
      return await musicApi.users.getSessionStatus();
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useUserListeningHistory(page = 1, size = 20) {
  return useQuery({
    queryKey: queryKeys.user.history(page, size),
    queryFn: async () => {
      const res = await musicApi.users.getListeningHistory(page, size);
      return res.data;
    },
    staleTime: 1000 * 60 * 3,
  });
}

export function useUserSearchHistory() {
  return useQuery({
    queryKey: queryKeys.user.searchHistory(),
    queryFn: async () => {
      const res = await musicApi.users.getSearchHistory();
      return (
        res.data || {
          recent: [],
          songs: [],
          artists: [],
          playlists: [],
          userPlaylists: [],
        }
      );
    },
    staleTime: 1000 * 60 * 2,
  });
}

export function useSaveSearchHistoryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: SaveSearchHistoryPayload) => {
      return await musicApi.users.saveSearchHistory(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.user.searchHistory(),
      });
    },
  });
}

export function useDeleteSearchHistoryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      return await musicApi.users.deleteSearchHistoryItem(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.user.searchHistory(),
      });
    },
  });
}

export function useClearSearchHistoryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      return await musicApi.users.clearSearchHistory();
    },
    onSuccess: () => {
      queryClient.setQueryData(queryKeys.user.searchHistory(), {
        recent: [],
        songs: [],
        artists: [],
        playlists: [],
        userPlaylists: [],
      });
      toast.success("Search history cleared");
    },
  });
}

export function useUpdateProfileMutation() {
  const queryClient = useQueryClient();
  const dispatch = useAppDispatch();
  return useMutation({
    mutationFn: async (userName: string) => {
      const res = await musicApi.users.updateProfile(userName);
      return res.data;
    },
    onSuccess: (updatedUser) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.user.profile(),
      });
      if (updatedUser) {
        dispatch(
          updateSystemUser({
            userName: updatedUser.userName,
            name: updatedUser.userName || updatedUser.name,
          }),
        );
      }
      toast.success("Profile updated successfully");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to update profile");
    },
  });
}

export function useRevokeSessionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (sessionId: string) => {
      return await musicApi.users.revokeSession(sessionId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.user.sessions(),
      });
      toast.success("Session revoked");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to revoke session");
    },
  });
}

export function useRevokeOtherSessionsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      return await musicApi.users.revokeOtherSessions();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.user.sessions(),
      });
      toast.success(data?.message || "Other sessions revoked");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to revoke sessions");
    },
  });
}
