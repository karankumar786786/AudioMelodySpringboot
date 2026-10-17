import type { Metadata } from "next";
import { serverMusicApi } from "@/lib/api/server-client";
import { MyPlaylistClientView } from "./MyPlaylistClientView";

interface MyPlaylistPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: MyPlaylistPageProps): Promise<Metadata> {
  const { id } = await params;

  if (id === "favourites") {
    return {
      title: "Favourites - One Melody",
      description: "Your saved collection of favourite songs and tracks on One Melody.",
    };
  }

  const playlistRes = await serverMusicApi.users.getPlaylistById(id);
  const playlist = playlistRes?.data;

  if (!playlist) {
    return {
      title: "Playlist - One Melody",
      description: "Listen to this playlist on One Melody.",
    };
  }

  const title = playlist.name || "Playlist";
  return {
    title: `${title} - My Playlist`,
    description:
      playlist.description ||
      `Stream "${title}" on One Melody in high definition lossless audio.`,
  };
}

export default async function MyPlaylistPage({ params }: MyPlaylistPageProps) {
  const { id } = await params;

  if (id === "favourites") {
    const favouritesRes = await serverMusicApi.users.getFavourites(1, 100);
    const favouritesSongs = favouritesRes?.data?.data || [];

    return (
      <MyPlaylistClientView
        id="favourites"
        initialPlaylist={{
          id: "favourites",
          name: "Favourites",
          description: "Your saved collection of favourite tracks and songs.",
          privacy: "PRIVATE",
          ownerName: "You",
          ownerId: "",
          totalSongs: favouritesSongs.length,
          coverImageKey: undefined,
        }}
        initialSongs={favouritesSongs}
      />
    );
  }

  const [playlistRes, songsRes] = await Promise.all([
    serverMusicApi.users.getPlaylistById(id),
    serverMusicApi.users.getPlaylistSongs(id),
  ]);

  return (
    <MyPlaylistClientView
      id={id}
      initialPlaylist={playlistRes?.data || null}
      initialSongs={songsRes?.data?.data || []}
    />
  );
}