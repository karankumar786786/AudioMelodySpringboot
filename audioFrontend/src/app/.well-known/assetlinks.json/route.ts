/**
 * Android App Links for the One Melody app (verifies https://<this host>/song/* links).
 * Served only when ANDROID_SHA256_CERT_FINGERPRINTS is set (comma-separated signing
 * certificate SHA-256 fingerprints); otherwise 404.
 */
export const dynamic = "force-dynamic";

const ANDROID_PACKAGE = process.env.ANDROID_PACKAGE || "com.karan.audioapp";

export function GET() {
  const fingerprints = (process.env.ANDROID_SHA256_CERT_FINGERPRINTS || "")
    .split(",")
    .map((f) => f.trim())
    .filter(Boolean);
  if (fingerprints.length === 0) return new Response("Not found", { status: 404 });

  return Response.json([
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: ANDROID_PACKAGE,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ]);
}
