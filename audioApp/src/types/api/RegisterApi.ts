export interface RegisterRequest {
    userName: string;
    email: string;
}

export interface RegisterResponse {
    tempToken: string;
}