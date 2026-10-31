import { algoliasearch, type SearchClient } from "algoliasearch";

const ALGOLIA_APP_ID =
  process.env.EXPO_PUBLIC_ALGOLIA_APP_ID || "NQKIDY69EZ";
const ALGOLIA_SEARCH_KEY =
  process.env.EXPO_PUBLIC_ALGOLIA_SEARCH_KEY ||
  "d56f43f0df08191b3eea750c0f4d3cd0";
const ALGOLIA_INDEX_NAME =
  process.env.EXPO_PUBLIC_ALGOLIA_INDEX_NAME || "one_melody_springboot";

let algoliaClientInstance: SearchClient | null = null;

export function getAlgoliaClient(): { client: SearchClient; indexName: string } {
  if (!algoliaClientInstance) {
    algoliaClientInstance = algoliasearch(
      ALGOLIA_APP_ID,
      ALGOLIA_SEARCH_KEY
    );
  }
  return { client: algoliaClientInstance, indexName: ALGOLIA_INDEX_NAME };
}
