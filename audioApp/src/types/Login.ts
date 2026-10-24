import { AuthToken } from "./AuthToken";

export interface LoginRequest{
    email:string;
}

export interface LoginResponse extends AuthToken {}