import { getStore } from "@edgeone/pages-blob";

export default async function onRequest(context) {
  const filename = context.params.file;
  if (!filename) {
    return new Response("Not Found", { status: 404 });
  }

  const key = "img/" + filename;
  const store = getStore("img_store");

  try {
    const blob = await store.get(key, { type: "arrayBuffer" });
    if (!blob || !blob.byteLength) {
      return new Response("Not Found", { status: 404 });
    }

    return new Response(blob, {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=86400, s-maxage=2592000",
        "CDN-Cache-Control": "max-age=2592000",
        "Expires": new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString()
      }
    });
  } catch (e) {
    return new Response("Not Found", { status: 404 });
  }
}
