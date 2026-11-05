import {
  UpdateProfileRequest,
  UpdateProfileResponse,
  UserProfileResponse,
} from "../api/UserApi";
import { Song } from "../entity/SongEntity";

export interface UserService {
  getProfile(): Promise<UserProfileResponse>;
  updateProfile(request: UpdateProfileRequest): Promise<UpdateProfileResponse>;
  getRecentlyPlayed?(): Promise<Song[]>;
}
