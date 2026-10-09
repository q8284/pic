import { getStore } from "@edgeone/pages-blob";

function pad(n) { return String(n).padStart(2, "0"); }

function genName() {
  const d = new Date();
  // UTC+8 转北京时间
  let h = d.getUTCHours() + 8;
  let day = d.getUTCDate();
  let month = d.getUTCMonth() + 1;
  let year = d.getUTCFullYear();
  if (h >= 24) { h -= 24; day += 1; }

  const yymmddhhmm = String(year).slice(-2) + pad(month) + pad(day) + pad(h) + pad(d.getUTCMinutes());
  const ss = pad(d.getUTCSeconds());
  const ms = String(d.getUTCMilliseconds()).padStart(3, "0");
  return `${yymmddhhmm}${ss}${ms}`;
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

  const filename = genName() + ".webp";
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

  // 从请求头拼完整 URL
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
