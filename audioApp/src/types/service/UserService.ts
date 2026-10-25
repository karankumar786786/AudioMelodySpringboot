import {
  UpdateProfileRequest,
  UpdateProfileResponse,
  UserProfileResponse,
} from "../api/UserApi";

export interface UserService {
  getProfile(): Promise<UserProfileResponse>;
  updateProfile(request: UpdateProfileRequest): Promise<UpdateProfileResponse>;
}
