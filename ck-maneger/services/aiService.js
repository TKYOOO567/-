const https = require('https');

const API_URL = process.env.AI_API_URL || 'https://ark.cn-beijing.volces.com/api/v3/responses';
const API_KEY = process.env.AI_API_KEY || 'ark-b6d00946-b8a6-42cb-b54a-9d42635c7e19-b7035';
const AI_MODEL = process.env.AI_MODEL || 'doubao-seed-2-0-lite-260428';

// keep-alive 连接池，减少每次请求的 TCP 握手时间
const keepAliveAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 10,
  maxFreeSockets: 5,
  timeout: 60000,
  freeSocketTimeout: 30000
});

// 固定的 22 个商品类别（来自业务定义，AI 必须从此清单中选择 category）
const CATEGORY_LIST = [
  'T5.平板灯', '光源', '球泡', '办公灯', '吸顶灯', '家居卧室灯',
  '风扇灯', '大厅灯', '浴霸排气', '低压灯带', '高压灯带', '靓星商照',
  '常规筒射灯', '深防眩筒射灯', '明装射灯', '星发现商照', '投光灯',
  '消防应急', '灯管防爆', '户外照明', '轨道配件', '私模板磁吸'
];

function buildPrompt(orderType) {
  if (orderType === 'inbound') {
    return [
      '请识别这张货单图片中的所有商品信息。对于每个商品，提取以下字段：',
      '- name: 商品名称',
      '- category: 商品分类（**必须**从下面的固定清单中精确挑选一个，输出文字必须与清单完全一致；若实在判断不出，留 null）',
      '- quantity: 数量',
      '- length / width / height: 长宽高，单位 cm（无则填 null）',
      '',
      '【固定类别清单（共 ' + CATEGORY_LIST.length + ' 个，必须从中选一个）】',
      CATEGORY_LIST.map((c, i) => (i + 1) + '. ' + c).join('\n'),
      '',
      '【判断要点】根据商品名称中的关键字推断：',
      '- 含"T5"且为灯具 → T5.平板灯',
      '- 含"球泡" → 球泡；含"光源/灯珠/LED模组" → 光源',
      '- 含"办公" → 办公灯；含"吸顶" → 吸顶灯；含"卧室" → 家居卧室灯',
      '- 含"风扇" → 风扇灯；含"大厅/客厅" → 大厅灯',
      '- 含"浴霸/排气" → 浴霸排气',
      '- 含"灯带"且低压 → 低压灯带；含"灯带"且高压 → 高压灯带',
      '- 含"筒灯/射灯"且为防眩 → 深防眩筒射灯；常规 → 常规筒射灯；明装 → 明装射灯',
      '- 含"靓星" → 靓星商照；含"星发现" → 星发现商照',
      '- 含"投光" → 投光灯；含"消防/应急" → 消防应急',
      '- 含"防爆" → 灯管防爆；含"户外" → 户外照明',
      '- 含"轨道" → 轨道配件；含"磁吸" → 私模板磁吸',
      '',
      '【重要约束】',
      '- 不要猜测 zone_code、row_num、col_num、layer_num，**这些字段一律留 null**，由系统统一分配',
      '- 只输出 JSON 数组，不要任何额外文字、不要 markdown 代码块',
      '- 格式：[{"name":"...","category":"...","quantity":N,"length":null,"width":null,"height":null}]'
    ].join('\n');
  } else {
    return "请识别这张货单图片中的所有商品编码。商品编码格式通常为类似'A-1-3-2-20260101-0001'的形式。请以JSON数组格式返回所有识别到的商品编码：[{code: '编码值'}]。只返回JSON数组，不要包含其他文字。";
  }
}

function extractJson(text) {
  const mdMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (mdMatch) {
    try {
      return JSON.parse(mdMatch[1].trim());
    } catch (e) {
    }
  }

  return JSON.parse(text.trim());
}

async function recognizeOrder(imageBase64, orderType, options) {
  const opts = options || {};
  let apiUrl = opts.apiUrl || API_URL;
  const apiKey = opts.apiKey || API_KEY;
  const model = opts.model || AI_MODEL;
  const prompt = buildPrompt(orderType);

  // URL 归一化：用户可能填了 base_url（无 /responses）或旧的 /chat/completions，统一修正
  const originalUrl = apiUrl;
  apiUrl = apiUrl.replace(/\/+$/, ''); // 去掉末尾斜杠
  if (apiUrl.endsWith('/chat/completions')) {
    apiUrl = apiUrl.replace(/\/chat\/completions$/, '/responses');
  } else if (!/\/responses$/.test(apiUrl)) {
    // 既不是 /responses 也不是 /chat/completions → 当成 base_url 处理，自动追加
    apiUrl = apiUrl + '/responses';
  }
  if (apiUrl !== originalUrl) {
    console.log(`[AI] URL 已自动归一化: ${originalUrl} → ${apiUrl}`);
  }

  const requestId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const maskedKey = apiKey ? apiKey.slice(0, 8) + '...' + apiKey.slice(-4) : '(空)';

  const imgSizeKB = Math.round(imageBase64.length * 0.75 / 1024);
  console.log(`[AI] [${requestId}] 开始识别 | 类型=${orderType} | 模型=${model} | 图片≈${imgSizeKB}KB`);

  const requestBody = JSON.stringify({
    model: model,
    input: [
      {
        role: 'user',
        content: [
          { type: 'input_image', image_url: `data:image/jpeg;base64,${imageBase64}` },
          { type: 'input_text', text: prompt }
        ]
      }
    ]
  });

  return new Promise((resolve) => {
    const url = new URL(apiUrl);
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: 'POST',
      agent: keepAliveAgent,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(requestBody)
      }
    };

    const startTime = Date.now();

    const req = https.request(options, (res) => {
      const statusCode = res.statusCode;
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        const elapsed = Date.now() - startTime;

        if (!data || !data.trim()) {
          console.log(`[AI] [${requestId}] ❌ 空响应 HTTP ${statusCode} | ${elapsed}ms`);
          resolve({ success: false, error: `API返回空响应体（HTTP ${statusCode}），请检查模型ID和API Key是否正确` });
          return;
        }

        try {
          const response = JSON.parse(data);
          if (response?.error) {
            const errMsg = response.error.message || JSON.stringify(response.error);
            console.log(`[AI] [${requestId}] ❌ API错误 HTTP ${statusCode} | ${elapsed}ms | ${errMsg}`);
            resolve({ success: false, error: `API错误（HTTP ${statusCode}）: ${errMsg}` });
            return;
          }

          let content = null;
          if (Array.isArray(response?.output)) {
            for (const item of response.output) {
              if (item.type === 'message' && Array.isArray(item.content)) {
                for (const part of item.content) {
                  if (part.type === 'output_text' && part.text) {
                    content = part.text;
                    break;
                  }
                }
              }
              if (content) break;
            }
          }

          if (!content) {
            console.log(`[AI] [${requestId}] ❌ 格式异常 HTTP ${statusCode} | ${elapsed}ms`);
            resolve({ success: false, error: `API返回数据格式异常（HTTP ${statusCode}）：` + data.substring(0, 300) });
            return;
          }

          const items = extractJson(content);
          if (!Array.isArray(items)) {
            console.log(`[AI] [${requestId}] ❌ 非数组 | ${elapsed}ms`);
            resolve({ success: false, error: '返回数据不是有效的数组格式，AI回复内容：' + content.substring(0, 200) });
            return;
          }

          console.log(`[AI] [${requestId}] ✅ 识别成功 ${items.length}条 | ${elapsed}ms`);
          resolve({ success: true, items });
        } catch (e) {
          console.log(`[AI] [${requestId}] ❌ 解析异常 HTTP ${statusCode} | ${elapsed}ms | ${e.message}`);
          resolve({ success: false, error: `解析AI返回数据失败（HTTP ${statusCode}）: ${e.message} | 原始数据: ${data.substring(0, 300)}` });
        }
      });
    });

    req.on('error', (e) => {
      console.log(`[AI] [${requestId}] ❌ 网络错误: ${e.message}`);
      resolve({ success: false, error: 'API请求失败: ' + e.message });
    });

    req.write(requestBody);
    req.end();
  });
}

module.exports = { recognizeOrder, CATEGORY_LIST };
