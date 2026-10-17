/**
 * Read-only cookie lookup helper for audioFrontend.
 * Reads cookies sent from the backend HTTP responses (via Set-Cookie headers).
 * No client-side cookie creation, deletion, or manipulation is performed here.
 */

export function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;

  const nameEQ = `${encodeURIComponent(name)}=`;
  const cookies = document.cookie.split(";");

  for (let i = 0; i < cookies.length; i++) {
    let c = cookies[i].trim();
    if (c.indexOf(nameEQ) === 0) {
      try {
        return decodeURIComponent(c.substring(nameEQ.length));
      } catch {
        return c.substring(nameEQ.length);
      }
    }
  }
  return null;
}
