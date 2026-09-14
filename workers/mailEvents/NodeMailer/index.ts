import nodemailer from "nodemailer";
import { config } from "dotenv";
config();

const smtpUser = process.env.SMTP_USER || "";
// Strip any spaces from the App Password (e.g. "abcd efgh ijkl mnop" -> "abcdefghijklmnop")
const smtpPass = (process.env.SMTP_PASS || "").replace(/\s+/g, "");
const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
const smtpPort = Number(process.env.SMTP_PORT) || 465;

// Ensure RFC compliant From address: "Sender Name" <email@example.com>
const rawFrom = (process.env.SMTP_FROM || "One Melody Springboot").trim();
const smtpFrom = rawFrom.includes("<") && rawFrom.includes(">")
    ? rawFrom
    : `"${rawFrom.replace(/"/g, "")}" <${smtpUser}>`;

const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    pool: true,
    maxConnections: 1,
    rateDelta: 1000,
    rateLimit: 1,
    auth: {
        user: smtpUser,
        pass: smtpPass,
    },
});

export async function sendMail(to: string, subject: string, body: string) {
    try {
        const info = await transporter.sendMail({
            from: smtpFrom,
            to,
            subject,
            text: body,
        });

        console.log("Mail sent successfully to %s: %s", to, info.messageId);
        return info;
    } catch (err) {
        console.error("Failed to send mail to %s:", to, err);
        throw err;
    }
}