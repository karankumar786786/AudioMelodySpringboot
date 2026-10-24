import { AuthToken } from "./AuthToken";

export interface RegisterRequest{
    name: string;
    email: string;
};
export interface RegisterResponse extends AuthToken{}