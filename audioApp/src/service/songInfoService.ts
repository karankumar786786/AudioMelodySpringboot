export interface SongInfoResult {
  song: {
    description: string | null;
    source: string | null;
  };
  artist: {
    name: string;
    description: string | null;
    image: string | null;
    imageWidth?: number | null;
    imageHeight?: number | null;
    source: string | null;
  };
}

async function fetchWikiSummary(title: string): Promise<any> {
  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.type === "disambiguation") return null;
    return data;
  } catch {
    return null;
  }
}

async function searchWikiTitle(query: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
        query
      )}&format=json&origin=*`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const results = data?.query?.search;
    if (results && results.length > 0) {
      return results[0].title;
    }
    return null;
  } catch {
    return null;
  }
}

function truncateSentences(text: string, maxSentences = 4): string {
  if (!text) return "";
  const sentences = text.match(/[^.!?]+[.!?]+/g);
  if (sentences && sentences.length > 0) {
    return sentences.slice(0, maxSentences).join(" ").trim();
  }
  return text.length > 320 ? text.slice(0, 320) + "..." : text;
}

/**
 * Fetches descriptive information about a song and artist using free Wikipedia / MediaWiki REST API,
 * matching the audioFrontend implementation.
 */
export async function getSongInfo(
  songName: string,
  artistName: string
): Promise<SongInfoResult> {
  if (!songName && !artistName) {
    return {
      song: { description: null, source: null },
      artist: { name: "", description: null, image: null, source: null },
    };
  }

  // 1. Fetch Artist Info
  let cleanArtist = artistName;
  if (cleanArtist.includes(",")) {
    cleanArtist = cleanArtist.split(",")[0];
  }
  cleanArtist = cleanArtist.trim();

  let artistData = cleanArtist ? await fetchWikiSummary(cleanArtist) : null;
  if (!artistData && cleanArtist) {
    const searchedArtistTitle = await searchWikiTitle(`${cleanArtist} musician`);
    if (searchedArtistTitle) {
      artistData = await fetchWikiSummary(searchedArtistTitle);
    }
  }

  // 2. Fetch Song Info
  let songData = songName ? await fetchWikiSummary(`${songName} (song)`) : null;
  if (!songData && songName) {
    songData = await fetchWikiSummary(songName);
  }
  if ((!songData || songData.type === "disambiguation") && songName) {
    const songQuery = `${songName} ${cleanArtist} song`;
    const searchedSongTitle = await searchWikiTitle(songQuery);
    if (searchedSongTitle) {
      songData = await fetchWikiSummary(searchedSongTitle);
    }
  }

  return {
    song: {
      description: songData?.extract ? truncateSentences(songData.extract, 4) : null,
      source: songData?.content_urls?.desktop?.page || null,
    },
    artist: {
      name: cleanArtist || artistData?.title || "Artist",
      description: artistData?.extract ? truncateSentences(artistData.extract, 4) : null,
      image: artistData?.originalimage?.source || artistData?.thumbnail?.source || null,
      imageWidth: artistData?.originalimage?.width || artistData?.thumbnail?.width || null,
      imageHeight: artistData?.originalimage?.height || artistData?.thumbnail?.height || null,
      source: artistData?.content_urls?.desktop?.page || null,
    },
  };
}
