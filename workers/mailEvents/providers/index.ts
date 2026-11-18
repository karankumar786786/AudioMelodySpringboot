import { createSmtpProvider } from "./smtp";
import { createSesProvider } from "./ses";
import { createResendProvider } from "./resend";
import type { Env, MailProvider } from "./types";

export type { MailProvider, MailMessage } from "./types";

/** Pick the transport from MAIL_PROVIDER (smtp | ses | resend). Defaults to smtp (Gmail). */
export function createMailProvider(env: Env = process.env): MailProvider {
    const name = (env.MAIL_PROVIDER || "smtp").trim().toLowerCase();
    switch (name) {
        case "smtp":
            return createSmtpProvider(env);
        case "ses":
            return createSesProvider(env);
        case "resend":
            return createResendProvider(env);
        default:
            throw new Error(`Unknown MAIL_PROVIDER "${name}". Expected one of: smtp, ses, resend.`);
    }
}
