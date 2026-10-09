import { getStore } from "@edgeone/pages-blob";

export default async function onRequest(context) {
  if (context.request.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "仅支持 POST" }), {
      status: 405,
      headers: { "Content-Type": "application/json" }
    });
  }

  let form;
  try {
    form = await context.request.formData();
  } catch (e) {
    return new Response(
      JSON.stringify({ success: false, error: "表单解析失败，可能文件过大" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const file = form.get("file");
  if (!file || typeof file === "string") {
    return new Response(JSON.stringify({ success: false, error: "缺少 file 字段" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const safeName = (file.name || `img-${Date.now()}.webp`).replace(/[^a-zA-Z0-9._-]/g, "");
  const key = `img/${Date.now()}-${safeName}`;
  const buf = await file.arrayBuffer();

  try {
    const store = getStore("img_store");
    await store.set(key, buf, {
      contentType: "image/webp",
      consistency: "strong"
    });
  } catch (e) {
    console.error("Blob put failed:", e);
    return new Response(
      JSON.stringify({ success: false, error: "存储失败：" + e.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const filename = key.split("/").pop();
  const url = `/i/${filename}`;

  return new Response(
    JSON.stringify({
      success: true,
      data: {
        filename,
        url,
        markdown: `![${safeName}](${url})`,
        html: `<img src="${url}" alt="${safeName}" />`,
        size: file.size
      }
    }),
    { headers: { "Content-Type": "application/json" } }
  );
}
