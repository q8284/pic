import { getStore } from "@edgeone/pages-blob";

export default async function onRequest(context) {
  try {
    const { params } = context;
    const name = String(params.file || "").replace(/[^a-zA-Z0-9._-]/g, "");
    if (!name) return new Response("Bad Request", { status: 400 });

    const store = getStore("img_store");
    const key = `img/${name}`;

    let ab;
    try {
      ab = await store.get(key, { type: "arrayBuffer", consistency: "strong" });
    } catch (e1) {
      const obj = await store.get(key);
      if (!obj) return new Response("Not Found", { status: 404 });
      if (obj instanceof ArrayBuffer) ab = obj;
      else if (obj.arrayBuffer) ab = await obj.arrayBuffer();
      else if (obj.body) ab = await new Response(obj.body).arrayBuffer();
      else if (typeof obj === "string") ab = new TextEncoder().encode(obj).buffer;
    }

    if (!ab) return new Response("Not Found", { status: 404 });

    return new Response(ab, {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=31536000",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (e) {
    return new Response("Server Error: " + e.message, { status: 500 });
  }
}
