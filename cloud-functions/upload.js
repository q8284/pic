import { getStore } from "@edgeone/pages-blob";

// ★ 硬编码你的真实域名，不要读 host 头
const DOMAIN = "https://api.qjww.cn";

function genBeijingName() {
  const ts = Date.now();
  const d = new Date(ts + 8 * 60 * 60 * 1000);
  const y = String(d.getUTCFullYear()).slice(-2);
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const h = String(d.getUTCHours()).padStart(2, '0');
  const min = String(d.getUTCMinutes()).padStart(2, '0');
  const s = String(d.getUTCSeconds()).padStart(2, '0');
  const ms = String(d.getUTCMilliseconds()).padStart(3, '0');
  return `${y}${m}${day}${h}${min}${s}${ms}.webp`;
}

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

  const filename = genBeijingName();
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

  // ★ 用固定域名拼完整 URL
  const fullUrl = `${DOMAIN}/img/${filename}`;

  return new Response(JSON.stringify({
    success: true,
    data: {
      filename,
      url: fullUrl
    }
  }), { headers: { "Content-Type": "application/json" } });
}
