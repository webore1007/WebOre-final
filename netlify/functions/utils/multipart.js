/**
 * Minimal multipart/form-data parser.
 *
 * The original media upload route used `multer`, which parses multipart
 * bodies off a live Express request stream and writes files straight to
 * disk. Neither of those exist in a Netlify Function (the whole request
 * body arrives as one buffer, and there's no persistent disk) — so this
 * parses the buffer directly. It's intentionally small: it only needs to
 * handle the one thing this app uses it for (a single "file" field), but
 * it will correctly parse multiple fields/files if ever needed.
 */

/** Extracts the multipart boundary from a Content-Type header. */
function getBoundary(contentType) {
  const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || "");
  if (!match) return null;
  return (match[1] || match[2]).trim();
}

/**
 * @param {Buffer} buffer Raw request body bytes.
 * @param {string} contentType The request's Content-Type header.
 * @returns {Array<{ name: string, filename: string|null, type: string|null, data: Buffer }>}
 */
export function parseMultipart(buffer, contentType) {
  const boundary = getBoundary(contentType);
  if (!boundary) return [];

  const boundaryMarker = Buffer.from(`--${boundary}`);
  const parts = [];

  let cursor = buffer.indexOf(boundaryMarker);
  while (cursor !== -1) {
    const next = buffer.indexOf(boundaryMarker, cursor + boundaryMarker.length);
    if (next === -1) break;

    let chunk = buffer.subarray(cursor + boundaryMarker.length, next);

    // Each part is preceded by "\r\n" and followed by "\r\n" (or "--\r\n"
    // for the final boundary) — trim those off.
    if (chunk.subarray(0, 2).toString("latin1") === "\r\n") chunk = chunk.subarray(2);
    if (chunk.subarray(-2).toString("latin1") === "\r\n") chunk = chunk.subarray(0, -2);

    const headerEnd = chunk.indexOf("\r\n\r\n");
    if (headerEnd !== -1) {
      const headerText = chunk.subarray(0, headerEnd).toString("utf8");
      const body = chunk.subarray(headerEnd + 4);

      const nameMatch = /name="([^"]*)"/i.exec(headerText);
      const filenameMatch = /filename="([^"]*)"/i.exec(headerText);
      const typeMatch = /Content-Type:\s*([^\r\n]+)/i.exec(headerText);

      if (nameMatch) {
        parts.push({
          name: nameMatch[1],
          filename: filenameMatch ? filenameMatch[1] : null,
          type: typeMatch ? typeMatch[1].trim() : null,
          data: Buffer.from(body),
        });
      }
    }

    cursor = next;
  }

  return parts;
}

/** Reads the raw request body as a Buffer, decoding base64 if needed. */
export function bodyToBuffer(event) {
  if (!event.body) return Buffer.alloc(0);
  return event.isBase64Encoded ? Buffer.from(event.body, "base64") : Buffer.from(event.body, "utf8");
}
