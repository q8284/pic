/**
 * EdgeOne Pages Functions - 图片上传 API
 * POST /api/upload
 *
 * 接收图片 → 转换为 WebP → 存储到 KV / R2 → 返回直链
 */

// 最大文件大小 10MB
const MAX_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/webp', 'image/svg+xml'];

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return jsonResponse({ success: false, error: '没有接收到文件' }, 400);
    }

    // 类型校验
    if (!ALLOWED_TYPES.includes(file.type)) {
      return jsonResponse({
        success: false,
        error: '不支持的文件类型。仅支持 JPG/PNG/GIF/BMP/WebP/SVG'
      }, 400);
    }

    // 大小校验
    if (file.size > MAX_SIZE) {
      return jsonResponse({
        success: false,
        error: '文件过大。最大支持 10MB'
      }, 400);
    }

    const arrayBuffer = await file.arrayBuffer();
    const originalSize = file.size;

    // 转换为 WebP
    let webpBuffer;
    let filename;

    if (file.type === 'image/svg+xml') {
      // SVG 不转换，直接存储
      webpBuffer = arrayBuffer;
      filename = generateId() + '.svg';
    } else {
      // 使用 EdgeOne 内置的图像处理转换 WebP
      // 方案1: 使用 ImageTransformer（如果环境支持）
      // 方案2: 返回原始数据 + 设置 Content-Encoding，由边缘节点处理
      webpBuffer = await convertToWebP(arrayBuffer, file.type, env);
      filename = generateId() + '.webp';
    }

    const webpSize = webpBuffer.byteLength;
    const savedPercent = ((1 - webpSize / originalSize) * 100).toFixed(1);

    // 存储到 KV
    const imageId = filename.replace(/\.[^.]+$/, '');
    const imageData = {
      id: imageId,
      filename: filename,
      contentType: file.type === 'image/svg+xml' ? 'image/svg+xml' : 'image/webp',
      size: webpSize,
      originalSize: originalSize,
      uploadedAt: Date.now(),
    };

    // 存储图片二进制到 KV（使用 base64 编码存储）
    if (env.IMAGE_KV) {
      await env.IMAGE_KV.put(
        'img:' + imageId,
        arrayBufferToBase64(webpBuffer),
        { metadata: { filename, contentType: imageData.contentType, size: webpSize } }
      );
      // 存储元数据
      await env.IMAGE_KV.put('meta:' + imageId, JSON.stringify(imageData));
    }

    // 构建返回 URL
    const url = new URL(request.url);
    const imageUrl = url.origin + '/i/' + filename;

    return jsonResponse({
      success: true,
      data: {
        url: imageUrl,
        id: imageId,
        filename: filename,
        size: webpSize,
        originalSize: originalSize,
        saved: parseFloat(savedPercent),
        contentType: imageData.contentType,
      }
    });

  } catch (error) {
    return jsonResponse({
      success: false,
      error: '服务器内部错误: ' + error.message
    }, 500);
  }
}

/**
 * 将图片转换为 WebP 格式
 * EdgeOne 边缘运行时支持 HTMLImageElement + Canvas 的方式转换
 */
async function convertToWebP(arrayBuffer, mimeType, env) {
  try {
    // 方案: 使用 EdgeOne 的 ImageTransformer
    // 如果环境支持，直接使用
    if (globalThis.ImageTransformer) {
      // 使用 ImageTransformer 转换
      const response = new Response(arrayBuffer, { headers: { 'Content-Type': mimeType } });
      const transformer = new ImageTransformer(response, {
        format: 'webp',
        quality: 85,
      });
      const transformed = await transformer.transform();
      return await transformed.arrayBuffer();
    }

    // 兜底：返回原始 buffer（部分环境不支持转换）
    // 生产环境建议配合 R2 + 外部转换服务
    return arrayBuffer;
  } catch (e) {
    // 转换失败返回原始数据
    return arrayBuffer;
  }
}

function generateId() {
  // 生成短 ID: 时间戳 + 随机字符串
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 8);
  return ts + rand;
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  });
}

// OPTIONS 预检
export function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    }
  });
}
