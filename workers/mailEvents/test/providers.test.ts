import { describe, it, expect } from "bun:test";
import { createMailProvider } from "../providers";
import { createResendProvider, ResendError } from "../providers/resend";
import { createSesProvider } from "../providers/ses";
import { formatFrom } from "../providers/types";

describe("createMailProvider", () => {
    it("defaults to smtp", () => {
        expect(createMailProvider({ SMTP_USER: "me@gmail.com", SMTP_PASS: "x" }).name).toBe("smtp");
    });
    it("selects ses and resend by MAIL_PROVIDER", () => {
        expect(createMailProvider({ MAIL_PROVIDER: "SES", AWS_REGION: "ap-south-1", MAIL_FROM: "noreply@x.com" }).name).toBe("ses");
        expect(createMailProvider({ MAIL_PROVIDER: "resend", RESEND_API_KEY: "re_x", MAIL_FROM: "noreply@x.com" }).name).toBe("resend");
    });
    it("rejects unknown providers and missing config", () => {
        expect(() => createMailProvider({ MAIL_PROVIDER: "carrier-pigeon" })).toThrow(/Unknown MAIL_PROVIDER/);
        expect(() => createMailProvider({ MAIL_PROVIDER: "resend", MAIL_FROM: "a@b.com" })).toThrow(/RESEND_API_KEY/);
        expect(() => createMailProvider({ MAIL_PROVIDER: "ses", MAIL_FROM: "a@b.com" })).toThrow(/AWS_REGION/);
        expect(() => createMailProvider({ MAIL_PROVIDER: "ses", AWS_REGION: "r", MAIL_FROM: "No Address" })).toThrow(/MAIL_FROM/);
    });
});

describe("formatFrom", () => {
    it("keeps the original SMTP_FROM behaviour", () => {
        expect(formatFrom("One Melody Springboot", "me@gmail.com")).toBe('"One Melody Springboot" <me@gmail.com>');
        expect(formatFrom(undefined, "me@gmail.com")).toBe('"One Melody Springboot" <me@gmail.com>');
        expect(formatFrom('"X" <x@y.com>', "me@gmail.com")).toBe('"X" <x@y.com>');
    });
});

describe("resend provider", () => {
    it("posts to the Resend API with a bearer key", async () => {
        const calls: { url: string; init: RequestInit }[] = [];
        const fakeFetch = (async (url: string, init: RequestInit) => {
            calls.push({ url, init });
            return new Response(JSON.stringify({ id: "msg_1" }), { status: 200 });
        }) as unknown as typeof fetch;
        const p = createResendProvider({ RESEND_API_KEY: "re_test", MAIL_FROM: '"One Melody" <noreply@x.com>' }, fakeFetch);
        const res = await p.send({ to: "a@b.com", subject: "LOGIN", text: "123456" });
        expect(res.messageId).toBe("msg_1");
        expect(calls[0]!.url).toBe("https://api.resend.com/emails");
        expect((calls[0]!.init.headers as Record<string, string>).Authorization).toBe("Bearer re_test");
        expect(JSON.parse(calls[0]!.init.body as string)).toEqual({
            from: '"One Melody" <noreply@x.com>',
            to: ["a@b.com"],
            subject: "LOGIN",
            text: "123456",
        });
    });

    it("throws ResendError and flags 401/403 as auth errors", async () => {
        const fakeFetch = (async () =>
            new Response(JSON.stringify({ name: "invalid_api_key", message: "API key is invalid" }), { status: 401 })) as unknown as typeof fetch;
        const p = createResendProvider({ RESEND_API_KEY: "bad", MAIL_FROM: "noreply@x.com" }, fakeFetch);
        const err = await p.send({ to: "a@b.com", subject: "s", text: "t" }).catch((e) => e);
        expect(err).toBeInstanceOf(ResendError);
        expect(p.isAuthError(err)).toBe(true);
        expect(p.isAuthError(new ResendError("rate", 429))).toBe(false);
    });
});

describe("ses provider", () => {
    it("sends a SESv2 SendEmail command", async () => {
        const sent: any[] = [];
        const client = { send: async (cmd: any) => { sent.push(cmd.input); return { MessageId: "ses-1" }; } };
        const p = createSesProvider({ AWS_REGION: "ap-south-1", MAIL_FROM: '"One Melody" <noreply@x.com>' }, client as any);
        const res = await p.send({ to: "a@b.com", subject: "LOGIN", text: "123456" });
        expect(res.messageId).toBe("ses-1");
        expect(sent[0]).toMatchObject({
            FromEmailAddress: '"One Melody" <noreply@x.com>',
            Destination: { ToAddresses: ["a@b.com"] },
            Content: { Simple: { Subject: { Data: "LOGIN" }, Body: { Text: { Data: "123456" } } } },
        });
    });

    it("flags credential errors as auth errors", () => {
        const p = createSesProvider({ AWS_REGION: "r", MAIL_FROM: "a@b.com" }, { send: async () => ({}) } as any);
        expect(p.isAuthError({ name: "InvalidClientTokenId" })).toBe(true);
        expect(p.isAuthError({ name: "Throttling", $metadata: { httpStatusCode: 400 } })).toBe(false);
        expect(p.isAuthError({ name: "X", $metadata: { httpStatusCode: 403 } })).toBe(true);
    });
});
