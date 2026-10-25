import {
  UserProfileResponse,
  UpdateProfileRequest,
  UpdateProfileResponse,
  UserService,
} from "@/types";
import { api } from "./baseApi";

export const userService: UserService = {
  async getProfile(): Promise<UserProfileResponse> {
    const response = await api.get<UserProfileResponse>("/user/profile");
    return response.data;
  },
  async updateProfile(
    request: UpdateProfileRequest,
  ): Promise<UpdateProfileResponse> {
    const response = await api.put<UpdateProfileResponse>(
      "/user/profile",
      request,
    );
    return response.data;
  },
};
