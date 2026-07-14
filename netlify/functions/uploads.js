import { getBlobFile } from "./utils/store.js";
import { errorResponse, preflight, segments } from "./utils/http.js";

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return preflight();
  if (event.httpMethod !== "GET") return errorResponse(405, "Method not allowed.");

  const parts = segments(event, "uploads"); // [":filename"]
  const filename = parts[0];
  if (!filename) return errorResponse(404, "Not found.");

  const file = await getBlobFile(`uploads/${filename}`);
  if (!file) return errorResponse(404, "File not found.");

  return {
    statusCode: 200,
    headers: {
      "Content-Type": file.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "Access-Control-Allow-Origin": "*",
    },
    body: file.data.toString("base64"),
    isBase64Encoded: true,
  };
};
