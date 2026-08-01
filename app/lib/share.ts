/**
 * Permalinks carry the code itself rather than an id, so sharing needs no
 * storage and no server. The payload is deflated when the browser supports it
 * (it typically cuts a snippet to a third), with a plain-text fallback so an
 * older browser still produces a working link.
 */

const DEFLATED = "d";
const PLAIN = "p";

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function supportsCompression(): boolean {
  return typeof CompressionStream !== "undefined";
}

async function deflate(text: string): Promise<Uint8Array> {
  const stream = new Blob([text])
    .stream()
    .pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function inflate(bytes: Uint8Array): Promise<string> {
  const stream = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  return new Response(stream).text();
}

export async function encodeCode(code: string): Promise<string> {
  if (supportsCompression()) {
    return DEFLATED + toBase64Url(await deflate(code));
  }
  return PLAIN + toBase64Url(new TextEncoder().encode(code));
}

export async function decodeCode(param: string): Promise<string | null> {
  try {
    const marker = param.slice(0, 1);
    const body = fromBase64Url(param.slice(1));
    if (marker === DEFLATED) {
      if (!supportsCompression()) return null;
      return await inflate(body);
    }
    if (marker === PLAIN) {
      return new TextDecoder().decode(body);
    }
    return null;
  } catch {
    // A hand-edited or truncated link should just fall back to the default
    // snippet rather than breaking the page.
    return null;
  }
}

export async function buildShareUrl(
  code: string,
  arraySize: number,
  challenger?: string | null
): Promise<string> {
  const url = new URL(window.location.href);
  url.search = "";
  url.searchParams.set("c", await encodeCode(code));
  url.searchParams.set("n", String(arraySize));
  // A second snippet is what makes a link a race, so no separate mode flag.
  if (challenger) {
    url.searchParams.set("d", await encodeCode(challenger));
  }
  return url.toString();
}

export type SharedState = {
  code: string | null;
  challenger: string | null;
  arraySize: number | null;
};

export async function readSharedState(): Promise<SharedState> {
  const params = new URLSearchParams(window.location.search);
  const encoded = params.get("c");
  const encodedChallenger = params.get("d");
  const size = Number(params.get("n"));
  return {
    code: encoded ? await decodeCode(encoded) : null,
    challenger: encodedChallenger ? await decodeCode(encodedChallenger) : null,
    arraySize: Number.isFinite(size) && size > 0 ? size : null,
  };
}
