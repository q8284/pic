import { getStore } from "@edgeone/pages-blob";

export default async function onRequest(context) {
  const { params } = context;
  const name = String(params.file || "").replace(/[^a-zA-Z0-9._-]/g, "");
  if (!name) return new Response("Bad Request", { status: 400 });

  const store = getStore("img_store");
  const key = `img/${name}`;

  try {
    const ab = await store.get(key, { type: "arrayBuffer", consistency: "strong" });
    if (!ab) return new Response("Not Found", { status: 404 });

    return new Response(ab, {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=31536000",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (e) {
    // 如果 type 参数不支持，用兜底方式
    try {
      const obj = await store.get(key);
      if (!obj) return new Response("Not Found", { status: 404 });
      
      let body;
      if (obj instanceof ArrayBuffer) body = obj;
      else if (obj.arrayBuffer) body = await obj.arrayBuffer();
      else if (obj.body) body = await new Response(obj.body).arrayBuffer();
      else body = new TextEncoder().encode(String(obj)).buffer;

      return new Response(body, {
        headers: {
          "Content-Type": "image/webp",
          "Cache-Control": "public, max-age=31536000",
          "Access-Control-Allow-Origin": "*"
        }
      });
    } catch (e2) {
      return new Response("Error: " + e2.message, { status: 500 });
    }
  }
}
