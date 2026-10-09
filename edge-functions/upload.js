// POST /upload
// 接收前端传来的 webp 文件，存 KV，返回链接
// KV 单值硬限制 1MB，超出拒绝

export async function onRequestPost(ctx) {
  const { request, env } = ctx;

  // ---------- 解析表单 ----------
  let formData;
  try {
    formData = await request.formData();
  } catch (e) {
    return new Response(JSON.stringify({ error: '无效的表单数据' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const file = formData.get('file');
  if (!file || typeof file === 'string') {
    return new Response(JSON.stringify({ error: '未提供文件' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // ---------- 格式校验 ----------
  const isWebP = file.type === 'image/webp' || file.name.endsWith('.webp');
  if (!isWebP) {
    return new Response(JSON.stringify({ 
      error: '请上传 WebP 格式。请使用页面上的上传工具，它会自动将图片转为 WebP。' 
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // ---------- 大小校验（KV 单值上限 1MB） ----------
  const MAX_SIZE = 1 * 1024 * 1024; // 1MB
  if (file.size > MAX_SIZE) {
    return new Response(JSON.stringify({ 
      error: `文件过大 (${(file.size / 1024 / 1024).toFixed(2)}MB)。KV 存储单值上限 1MB，请降低 WebP 质量或选择更小的图片。` 
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // ---------- 生成文件名 ----------
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const filename = `${id}.webp`;

  // ---------- 读取内容 ----------
  const arrayBuffer = await file.arrayBuffer();

  // ---------- 存入 KV（数据） ----------
  await env.IMG_KV.put(`img:${filename}`, arrayBuffer, {
    metadata: {
      type: 'image/webp',
      size: file.size,
      uploadedAt: new Date().toISOString()
    }
  });

  // ---------- 存 meta（供 /i/ 路由读取 content-type） ----------
  await env.IMG_KV.put(`meta:${filename}`, JSON.stringify({
    type: 'image/webp',
    size: file.size,
    uploadedAt: new Date().toISOString()
  }));

  // ---------- 更新计数 ----------
  let count = 0;
  const countRaw = await env.IMG_KV.get('__count__');
  if (countRaw) count = parseInt(countRaw);
  await env.IMG_KV.put('__count__', (count + 1).toString());

  // ---------- 返回结果 ----------
  const baseUrl = new URL(request.url).origin;
  const imageUrl = `${baseUrl}/i/${filename}`;

  return new Response(JSON.stringify({
    success: true,
    data: {
      url: imageUrl,
      filename: filename,
      size: file.size,
      sizeHuman: (file.size / 1024).toFixed(1) + 'KB',
      html: `<img src="${imageUrl}" alt="upload" />`,
      markdown: `![upload](${imageUrl})`
    }
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

// OPTIONS 预检
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
