import { getStore } from "@edgeone/pages-blob";

export default async function onRequest(context) {
  try {
    const { params } = context;
    
    // 1. 过滤非法字符，防止路径遍历攻击
    const name = String(params.file || "").replace(/[^a-zA-Z0-9._-]/g, "");
    if (!name) return new Response("Bad Request", { status: 400 });

    // 2. 必须与上传函数里的存储名完全一致！
    const store = getStore("img_store"); 
    const key = `img/${name}`;

    // 3. 兼容不同版本 SDK 的返回值，强制转 ArrayBuffer
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

    // 4. 返回图片二进制流
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
