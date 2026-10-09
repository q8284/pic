import { getStore } from "@edgeone/pages-blob";

export default async function onRequest(context) {
  if (context.request.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "仅支持 POST" }), {
      status: 405, headers: { "Content-Type": "application/json" }
    });
  }

  let form;
  try { form = await context.request.formData(); }
  catch (e) {
    return new Response(JSON.stringify({ success: false, error: "表单解析失败" }), {
      status: 400, headers: { "Content-Type": "application/json" }
    });
  }

  const file = form.get("file");
  if (!file || typeof file === "string") {
    return new Response(JSON.stringify({ success: false, error: "缺少 file" }), {
      status: 400, headers: { "Content-Type": "application/json" }
    });
  }

  // 优先用前端传来的北京时间文件名
  let filename = form.get("filename");
  if (!filename || typeof filename !== "string") {
    filename = String(Date.now()) + ".webp";
  }
  if (!filename.endsWith(".webp")) {
    filename = filename.replace(/\.[^.]+$/, "") + ".webp";
  }

  const key = `img/${filename}`;
  const buf = await file.arrayBuffer();

  try {
    const store = getStore("img_store");
    await store.set(key, buf, {
      contentType: "image/webp",
      consistency: "strong"
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: "存储失败:" + e.message }), {
      status: 500, headers: { "Content-Type": "application/json" }
    });
  }

  const host = context.request.headers.get("host") || "";
  const proto = context.request.headers.get("x-forwarded-proto") || "https";
  const fullUrl = `https://${host}/img/${filename}`;

  return new Response(JSON.stringify({
    success: true,
    data: {
      filename,
      url: fullUrl
    }
  }), { headers: { "Content-Type": "application/json" } });
}
