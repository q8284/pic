import { getStore } from "@edgeone/pages-blob";

function pad(n) { return String(n).padStart(2, "0"); }

function genName() {
  const d = new Date();
  const yymmddhhmm =
    String(d.getFullYear()).slice(-2) +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    pad(d.getHours()) +
    pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  const ms = String(d.getMilliseconds()).padStart(3, "0");
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

  const url = `/img/${filename}`;
  return new Response(JSON.stringify({
    success: true,
    data: {
      filename,
      url,
      markdown: `![image](${url})`,
      html: `<img src="${url}" />`,
      size: file.size
    }
  }), { headers: { "Content-Type": "application/json" } });
}
