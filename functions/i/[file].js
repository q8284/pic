/**
 * EdgeOne Pages Functions - 图片访问路由
 * /i/:filename  →  返回图片
 *
 * 使用 [file].js 动态路由捕获文件名
 */

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const filename = url.pathname.replace('/i/', '');

  if (!filename || filename === '') {
    return new Response('Not Found', { status: 404 });
  }

  // 从 KV 获取图片
  if (env.IMAGE_KV) {
    const imageId = filename.replace(/\.[^.]+$/, '');
    const stored = await env.IMAGE_KV.get('img:' + imageId);

    if (stored) {
      const ext = filename.split('.').pop().toLowerCase();
      const contentType = ext === 'svg' ? 'image/svg+xml' : 'image/webp';

      // base64 解码
      const binary = atob(stored);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      return new Response(bytes.buffer, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000, immutable',
          'CDN-Cache-Control': 'public, max-age=31536000',
          'Access-Control-Allow-Origin': '*',
          'X-Content-Type-Options': 'nosniff',
        }
      });
    }
  }

  // 本地开发模式：尝试从 images 目录读取（需要在 edgeone.json 中配置静态资源）
  return new Response('Image not found', { status: 404 });
}
