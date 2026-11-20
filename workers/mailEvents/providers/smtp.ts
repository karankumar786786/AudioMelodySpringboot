import nodemailer from "nodemailer";
import { formatFrom, type Env, type MailProvider } from "./types";

/** Gmail (or any SMTP) via nodemailer. Behaviour matches the original worker. */
export function createSmtpProvider(env: Env): MailProvider {
    const smtpUser = env.SMTP_USER || "";
    // Strip any spaces from the App Password (e.g. "abcd efgh ijkl mnop" -> "abcdefghijklmnop")
    const smtpPass = (env.SMTP_PASS || "").replace(/\s+/g, "");
    const smtpHost = env.SMTP_HOST || "smtp.gmail.com";
    const smtpPort = Number(env.SMTP_PORT) || 465;
    const from = formatFrom(env.MAIL_FROM || env.SMTP_FROM, smtpUser);

    const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        pool: true,
        maxConnections: 1,
        rateDelta: 1000,
        rateLimit: 1,
        auth: { user: smtpUser, pass: smtpPass },
    });

    return {
        name: "smtp",
        async send({ to, subject, text }) {
            const info = await transporter.sendMail({ from, to, subject, text });
            return { messageId: info.messageId };
        },
        isAuthError(error: any) {
            return (
                error?.code === "EAUTH" ||
                error?.responseCode === 454 ||
                error?.responseCode === 535 ||
                /Too many login attempts/i.test(error?.message || "")
            );
        },
    };
}
