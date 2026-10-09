import { getStore } from "@edgeone/pages-blob";

function genName() {
  const d = new Date();
  // 明确用北京时间时区格式化，彻底避免 UTC 偏差
  const str = d.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
  // str 格式："2026/10/9 15:35:14"
  const match = str.match(/(\d+)\/(\d+)\/(\d+)\s+(\d+):(\d+):(\d+)/);
  if (!match) {
    // fallback：用时间戳兜底
    return String(Date.now());
  }
  const year = match[1].slice(-2);
  const month = match[2].padStart(2, "0");
  const day = match[3].padStart(2, "0");
  const hour = match[4].padStart(2, "0");
  const minute = match[5].padStart(2, "0");
  const second = match[6].padStart(2, "0");
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  return `${year}${month}${day}${hour}${minute}${second}${ms}`;
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

  // 从请求头拼完整 URL（带域名）
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
