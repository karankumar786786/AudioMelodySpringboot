export interface MailMessage {
    to: string;
    subject: string;
    text: string;
}

export interface MailProvider {
    readonly name: "smtp" | "ses" | "resend";
    send(message: MailMessage): Promise<{ messageId?: string }>;
    /** True when the error means credentials were rejected (every send would fail). */
    isAuthError(error: unknown): boolean;
}

export type Env = Record<string, string | undefined>;

/** Ensure an RFC 5322 From header: `"Name" <addr>`; a bare name is paired with `fallbackAddress`. */
export function formatFrom(raw: string | undefined, fallbackAddress: string, defaultName = "One Melody Springboot"): string {
    const value = (raw || defaultName).trim();
    if (value.includes("<") && value.includes(">")) return value;
    if (/^[^\s@]+@[^\s@]+$/.test(value)) return value;
    return `"${value.replace(/"/g, "")}" <${fallbackAddress}>`;
}
