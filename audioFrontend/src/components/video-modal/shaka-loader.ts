// Use any to avoid shaka-player compiled type namespace mismatches
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let shakaCache: any = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadShaka(): Promise<any> {
  if (shakaCache) return shakaCache;
  // shaka-player uses a UMD/namespace build; import as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod = await import("shaka-player" as any);
  shakaCache = mod.default ?? mod;
  return shakaCache;
}
