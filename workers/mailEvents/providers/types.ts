/** Ek email: kisko, subject, text. */
export interface MailMessage {
    to: string;
    subject: string;
    text: string;
}

/** Har mail provider (smtp / ses / resend) ye teen cheezein deta hai. */
export interface MailProvider {
    readonly name: "smtp" | "ses" | "resend";
    send(message: MailMessage): Promise<{ messageId?: string }>;
    /** Error ka matlab credentials reject hue? (tab har send fail hoga) */
    isAuthError(error: unknown): boolean;
}

/** Env variables ka map. */
export type Env = Record<string, string | undefined>;

/** Sahi From header banao: `"Name" <addr>`. Sirf naam diya ho to `fallbackAddress` ke saath jodo. */
export function formatFrom(raw: string | undefined, fallbackAddress: string, defaultName = "One Melody Springboot"): string {
    const value = (raw || defaultName).trim();
    if (value.includes("<") && value.includes(">")) return value;
    if (/^[^\s@]+@[^\s@]+$/.test(value)) return value;
    return `"${value.replace(/"/g, "")}" <${fallbackAddress}>`;
}
