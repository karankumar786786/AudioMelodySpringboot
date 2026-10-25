import { UserProfile } from "../entity/UserEntity";


export interface UserProfileResponse extends UserProfile{}

export interface UpdateProfileRequest {
    userName: string;
}

export interface UpdateProfileResponse extends UserProfileResponse{}
