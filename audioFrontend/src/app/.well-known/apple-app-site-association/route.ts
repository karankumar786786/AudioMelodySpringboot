/**
 * iOS universal links for /song/* (opens shared songs in the One Melody app).
 * Served only when APPLE_TEAM_ID is set; otherwise 404, so nothing changes until
 * the app is configured with the matching associated domain.
 */
export const dynamic = "force-dynamic";

const IOS_BUNDLE_ID = process.env.IOS_BUNDLE_ID || "com.karan.audioapp";

export function GET() {
  const teamId = process.env.APPLE_TEAM_ID?.trim();
  if (!teamId) return new Response("Not found", { status: 404 });

  return Response.json({
    applinks: {
      details: [
        {
          appIDs: [`${teamId}.${IOS_BUNDLE_ID}`],
          components: [{ "/": "/song/*", comment: "Shared songs" }],
        },
      ],
    },
  });
}
