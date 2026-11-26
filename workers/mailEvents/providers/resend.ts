import { formatFrom, type Env, type MailProvider } from "./types";

/** Resend API ka error, HTTP status ke saath (401/403 = credentials galat). */
export class ResendError extends Error {
    constructor(message: string, readonly status: number, readonly code?: string) {
        super(message);
        this.name = "ResendError";
    }
}

/** Resend ke HTTP API se email (https://resend.com/docs/api-reference/emails/send-email). 15 second timeout. */
export function createResendProvider(env: Env, fetchImpl: typeof fetch = fetch): MailProvider {
    const apiKey = env.RESEND_API_KEY;
    if (!apiKey) throw new Error("MAIL_PROVIDER=resend requires RESEND_API_KEY");
    const from = formatFrom(env.MAIL_FROM, "");
    if (!/<[^>]+@[^>]+>|^[^\s@]+@[^\s@]+$/.test(from)) {
        throw new Error("MAIL_PROVIDER=resend requires MAIL_FROM with an address on a verified Resend domain");
    }
    const endpoint = (env.RESEND_API_URL || "https://api.resend.com").replace(/\/+$/, "") + "/emails";

    return {
        name: "resend",
        async send({ to, subject, text }) {
            const response = await fetchImpl(endpoint, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ from, to: [to], subject, text }),
                signal: AbortSignal.timeout(15000),
            });
            const body: any = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new ResendError(
                    `Resend API ${response.status}: ${body?.message || response.statusText}`,
                    response.status,
                    body?.name,
                );
            }
            return { messageId: body?.id };
        },
        isAuthError(error: any) {
            return error instanceof ResendError && (error.status === 401 || error.status === 403);
        },
    };
}
