import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: true, // Port 465 uses SSL
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

export async function sendMail(to:string, subject:string, body:string) {
    try {
        const info = await transporter.sendMail({
            from: process.env.SMTP_FROM,
            to,
            subject,
            text: body,
        });

        console.log("Mail sent:", info.messageId);
        return info;
    } catch (err) {
        console.error("Failed to send mail:", err);
        throw err;
    }
}