import type { Metadata } from "next";
import { getImageUrl } from "@/lib/image-utils";
import { SongShareClientView } from "./SongShareClientView";

/**
 * Public song page: /song/<id>?t=<title>&a=<artist>&c=<imageKey>
 *
 * Share links from the mobile app point here. The song API needs a login, so the
 * server can't look the song up while building the link preview; the title, artist
 * and cover key come from the share link's query string instead. Signed-in visitors
 * get the real song (fetched client-side) and can play it.
 */

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

interface SongPageProps {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}

const MAX_LENGTH = 120;

function readParam(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed ? trimmed.slice(0, MAX_LENGTH) : undefined;
}

/** Only bare storage keys are accepted, so a crafted link can't point the preview at any URL. */
function readCoverKey(value: string | string[] | undefined): string | undefined {
  const key = readParam(value);
  if (!key || /^[a-z][a-z0-9+.-]*:/i.test(key) || key.startsWith("//")) return undefined;
  return key;
}

async function readShareMeta(searchParams: SearchParams) {
  const sp = await searchParams;
  return {
    title: readParam(sp.t),
    artist: readParam(sp.a),
    coverKey: readCoverKey(sp.c),
  };
}

export async function generateMetadata({
  params,
  searchParams,
}: SongPageProps): Promise<Metadata> {
  const { id } = await params;
  const { title, artist, coverKey } = await readShareMeta(searchParams);

  const heading = title ? (artist ? `${title} by ${artist}` : title) : "Listen on One Melody";
  const description = artist
    ? `Listen to "${title ?? "this song"}" by ${artist} on One Melody. Lossless audio streaming.`
    : "Listen on One Melody. Lossless audio streaming.";
  const cover =
    getImageUrl(coverKey, { width: 1200, height: 1200, aspectRatio: "1-1" }) ?? "/icon-512.png";

  return {
    title: heading,
    description,
    alternates: { canonical: `/song/${encodeURIComponent(id)}` },
    openGraph: {
      type: "music.song",
      title: heading,
      description,
      siteName: "One Melody",
      url: `/song/${encodeURIComponent(id)}`,
      images: [{ url: cover, width: 1200, height: 1200, alt: title ?? "One Melody" }],
    },
    twitter: {
      card: "summary_large_image",
      title: heading,
      description,
      images: [cover],
    },
    other: {
      // Read by link previews that understand music metadata.
      ...(artist ? { "music:musician_description": artist } : {}),
      // Custom-scheme hint so the app can be opened from the page.
      "al:ios:url": `audioapp://song/${encodeURIComponent(id)}`,
      "al:android:url": `audioapp://song/${encodeURIComponent(id)}`,
      "al:android:package": "com.karan.audioapp",
      "al:ios:app_name": "One Melody",
      "al:android:app_name": "One Melody",
    },
  };
}

export default async function SongPage({ params, searchParams }: SongPageProps) {
  const { id } = await params;
  const meta = await readShareMeta(searchParams);
  return <SongShareClientView id={id} {...meta} />;
}
