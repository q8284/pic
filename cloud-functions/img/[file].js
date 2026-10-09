import { getStore } from "@edgeone/pages-blob";

export default async function onRequest(context) {
  try {
    const name = String(context.params?.file || "").replace(/[^a-zA-Z0-9._-]/g, "");
    if (!name) return new Response("bad name", { status: 400 });

    const key = `img/${name}`;
    const store = getStore("img_store");

    let ab = null;
    try {
      ab = await store.get(key, { type: "arrayBuffer", consistency: "strong" });
    } catch (e1) {
      console.error("get-arraybuffer-fail", key, e1?.message || String(e1));
    }

    if (!ab) {
      const obj = await store.get(key, { consistency: "strong" });
      if (!obj) return new Response("not found:" + key, { status: 404 });
      try {
        if (obj instanceof ArrayBuffer) ab = obj;
        else if (obj?.arrayBuffer) ab = await obj.arrayBuffer();
        else if (typeof obj === "string") ab = new TextEncoder().encode(obj).buffer;
        else ab = await new Response(obj).arrayBuffer();
      } catch (e2) {
        console.error("parse-fail", key, e2?.message || String(e2));
        return new Response("parse fail", { status: 500 });
      }
    }
    if (!ab) return new Response("not found2:" + key, { status: 404 });

    return new Response(ab, {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=86400",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (e) {
    console.error("img-handler-error", e?.message || String(e));
    return new Response("img error:" + (e?.message || e), { status: 500 });
  }
}
