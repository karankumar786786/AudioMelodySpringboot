import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { formatFrom, type Env, type MailProvider } from "./types";

const AUTH_ERROR_NAMES = new Set([
    "AccessDeniedException",
    "UnrecognizedClientException",
    "InvalidClientTokenId",
    "InvalidSignatureException",
    "SignatureDoesNotMatch",
    "ExpiredTokenException",
    "AccountSuspendedException",
    "SendingPausedException",
    "MailFromDomainNotVerifiedException",
]);

/**
 * Amazon SES via the SESv2 SendEmail API. Credentials come from the standard
 * AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_REGION variables (or any
 * other source in the default AWS credential chain, e.g. an instance role).
 */
export function createSesProvider(env: Env, client?: Pick<SESv2Client, "send">): MailProvider {
    const region = env.SES_REGION || env.AWS_REGION;
    if (!region) throw new Error("MAIL_PROVIDER=ses requires AWS_REGION (or SES_REGION)");
    const from = formatFrom(env.MAIL_FROM, "");
    if (!/<[^>]+@[^>]+>|^[^\s@]+@[^\s@]+$/.test(from)) {
        throw new Error("MAIL_PROVIDER=ses requires MAIL_FROM with an address on a verified SES identity");
    }
    const configurationSet = env.SES_CONFIGURATION_SET || undefined;

    const ses = client ?? new SESv2Client({ region });

    return {
        name: "ses",
        async send({ to, subject, text }) {
            const result = await ses.send(
                new SendEmailCommand({
                    FromEmailAddress: from,
                    Destination: { ToAddresses: [to] },
                    Content: {
                        Simple: {
                            Subject: { Data: subject, Charset: "UTF-8" },
                            Body: { Text: { Data: text, Charset: "UTF-8" } },
                        },
                    },
                    ConfigurationSetName: configurationSet,
                }),
            );
            return { messageId: result.MessageId };
        },
        isAuthError(error: any) {
            const status = error?.$metadata?.httpStatusCode;
            return AUTH_ERROR_NAMES.has(error?.name) || status === 401 || status === 403;
        },
    };
}
