import { getStore } from "@edgeone/pages-blob";

export default async function onRequest(context) {
  const { params } = context;
  const key = `img/${params.file}`;
  const store = getStore("img_store");

  const object = await store.get(key, {
    type: "blob",
    consistency: "strong"
  });

  if (!object) {
    return new Response("Not Found", { status: 404 });
  }

  return new Response(object, {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=31536000",
      "ETag": `"${params.file}"`
    }
  });
}
