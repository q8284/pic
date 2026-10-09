// GET /i/:file
// 从 KV 读取图片并返回

export async function onRequestGet(ctx) {
  const { request, env } = ctx;
  const url = new URL(request.url);
  const filename = url.pathname.replace('/i/', '');

  if (!filename || filename === '__count__') {
    return new Response('Not Found', { status: 404 });
  }

  const value = await env.IMG_KV.get(`img:${filename}`, { type: 'arrayBuffer' });
  if (!value) {
    return new Response('Image not found', { status: 404 });
  }

  // 获取 metadata
  const metaRaw = await env.IMG_KV.get(`img:${filename}`, { type: 'text' });
  // KV get with arrayBuffer doesn't return metadata directly
  // 需要单独存一份 meta
  const metaValue = await env.IMG_KV.get(`meta:${filename}`);
  let contentType = 'image/webp';
  if (metaValue) {
    try {
      const meta = JSON.parse(metaValue);
      contentType = meta.type || 'image/webp';
    } catch (e) {}
  }

  return new Response(value, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'CDN-Cache-Control': 'public, max-age=31536000',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
