export interface SongInfoResult {
  song: {
    description: string | null;
    source: string | null;
  };
  artist: {
    name: string;
    description: string | null;
    image: string | null;
    source: string | null;
  };
}

async function fetchWikiSummary(title: string) {
  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
        title
      )}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.type === "disambiguation") return null;
    return data;
  } catch (err) {
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
  } catch (err) {
    return null;
  }
}

function truncateSentence(text: string, maxSentences = 3): string {
  if (!text) return "";
  // Trim clean sentences
  const sentences = text.match(/[^.!?]+[.!?]+/g);
  if (sentences && sentences.length > 0) {
    return sentences.slice(0, maxSentences).join(" ").trim();
  }
  return text.length > 280 ? text.slice(0, 280) + "..." : text;
}

/**
 * Fetches descriptive information about a song and artist using free Wikipedia / MediaWiki REST API.
 * @param songName - Name of the song
 * @param artistName - Name of the artist
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
  if (artistName.includes(",")) {
    artistName = artistName.split(",")[0];
  }
  let artistData = artistName ? await fetchWikiSummary(artistName) : null;
  if (!artistData && artistName) {
    const searchedArtistTitle = await searchWikiTitle(`${artistName} musician`);
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
    const songQuery = `${songName} ${artistName} song`;
    const searchedSongTitle = await searchWikiTitle(songQuery);
    if (searchedSongTitle) {
      songData = await fetchWikiSummary(searchedSongTitle);
    }
  }

  return {
    song: {
      description: songData?.extract ? truncateSentence(songData.extract, 3) : null,
      source: songData?.content_urls?.desktop?.page || null,
    },
    artist: {
      name: artistName || artistData?.title || "Artist",
      description: artistData?.extract ? truncateSentence(artistData.extract, 3) : null,
      image: artistData?.thumbnail?.source || null,
      source: artistData?.content_urls?.desktop?.page || null,
    },
  };
}
