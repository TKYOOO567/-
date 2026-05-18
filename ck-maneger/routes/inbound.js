const express = require('express');
const router = express.Router();
const { getInboundPage, createInbound, getZoneDetail, downloadTemplate, importExcel } = require('../controllers/productController');
const { requireLogin } = require('../middleware/auth');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

async function autoAssignPosition(zone_code, product, db) {
  // 1. 通过db查询Zone模型获取zone信息
  const Zone = db.Zone;
  const Product = db.Product;
  const zone = await Zone.findOne({ where: { code: zone_code } });
  if (!zone) return null;

  // 2. 查询该zone下所有status='in_stock'的商品，构建已占用位置集合
  const occupied = await Product.findAll({
    where: { zone_code: zone_code, status: 'in_stock' },
    attributes: ['row_num', 'col_num', 'layer_num']
  });
  const occupiedSet = new Set(occupied.map(p => `${p.row_num}-${p.col_num}-${p.layer_num}`));

  // 3. 判断商品是否有尺寸
  const hasSize = product.length && product.width && product.height;

  // 4. 遍历所有位置(row 1→rows, col 1→cols, layer 1→layers)
  for (let row = 1; row <= zone.rows; row++) {
    for (let col = 1; col <= zone.cols; col++) {
      for (let layer = 1; layer <= zone.layers; layer++) {
        const key = `${row}-${col}-${layer}`;
        if (occupiedSet.has(key)) continue; // 跳过已占用

        if (hasSize) {
          // 检查尺寸：商品cm vs 货位m*100
          const cellWidthCm = zone.cell_width * 100;
          const cellHeightCm = zone.cell_height * 100;
          const cellDepthCm = zone.cell_depth * 100;
          if (product.length <= cellDepthCm && product.width <= cellWidthCm && product.height <= cellHeightCm) {
            return { row_num: row, col_num: col, layer_num: layer };
          }
        } else {
          // 无尺寸，直接分配第一个空位
          return { row_num: row, col_num: col, layer_num: layer };
        }
      }
    }
  }

  return null; // 无可用位置
}

router.get('/inbound', requireLogin, getInboundPage);
router.post('/api/inbound', requireLogin, async function(req, res, next) {
  try {
    const autoAssign = req.body.auto_assign === true || req.body.auto_assign === 'true';

    if (autoAssign) {
      const { zone_code, length, width, height } = req.body;
      if (!zone_code) {
        return res.status(400).json({ success: false, error: '请填写区域编码' });
      }
      const position = await autoAssignPosition(zone_code, { length, width, height }, req.models);
      if (!position) {
        return res.status(400).json({ success: false, message: '该区域无可用货位（可能所有位置已占用或商品尺寸超出货位限制）' });
      }
      req.body.row_num = position.row_num;
      req.body.col_num = position.col_num;
      req.body.layer_num = position.layer_num;
    }

    return createInbound(req, res);
  } catch (err) {
    return res.status(500).json({ success: false, error: '服务器错误：' + err.message });
  }
});
router.get('/api/inbound/template', requireLogin, downloadTemplate);
router.post('/api/inbound/excel', requireLogin, upload.single('file'), importExcel);
router.get('/api/zones/:code', requireLogin, getZoneDetail);

/**
 * 按业务规则"同类同区"为识别结果分配 zone_code。
 * 规则：
 *   1) 优先：该 category 在历史 Product 中已经被存放过 → 用占用最多的那个 zone
 *   2) 否则：从未被任何类别绑定的 zone 中按字母顺序挑一个
 *   3) 实在没空 zone（zone 不够用）→ zone_code 留 null，前端会提示让用户手动选
 * 同一识别批次中相同 category 共用一个 zone。
 */
async function assignZonesByCategory(items, models) {
  if (!Array.isArray(items) || items.length === 0) return { assignedCount: 0, unassignedCategories: [] };
  const { Product, Zone } = models;

  // 1. 所有可用 zone（按 code 字母序）
  const allZonesRaw = await Zone.findAll({ attributes: ['code'], order: [['code', 'ASC']], raw: true });
  const allZoneCodes = allZonesRaw.map(z => z.code);

  // 2. 历史 category → zone 投票
  const existing = await Product.findAll({
    attributes: ['category', 'zone_code'],
    raw: true
  });
  const votes = {}; // { category: { zone: count } }
  existing.forEach(p => {
    if (!p.category || !p.zone_code) return;
    if (!votes[p.category]) votes[p.category] = {};
    votes[p.category][p.zone_code] = (votes[p.category][p.zone_code] || 0) + 1;
  });

  const categoryToZone = {};   // 已确定的映射
  const usedZones = new Set(); // 被任何 category 绑定的 zone

  Object.keys(votes).forEach(cat => {
    let bestZone = null;
    let bestCount = -1;
    Object.entries(votes[cat]).forEach(([z, c]) => {
      if (c > bestCount && allZoneCodes.indexOf(z) !== -1) { bestCount = c; bestZone = z; }
    });
    if (bestZone) {
      categoryToZone[cat] = bestZone;
      usedZones.add(bestZone);
    }
  });

  // 3. 给本次识别结果分配
  const unassignedCategories = [];
  let assignedCount = 0;

  items.forEach(item => {
    if (!item.category) return; // 没有 category 不能分配，前端会要求用户自己挑
    if (categoryToZone[item.category]) {
      item.zone_code = categoryToZone[item.category];
      assignedCount++;
      return;
    }
    // 新类别：找空闲 zone
    const free = allZoneCodes.find(z => !usedZones.has(z));
    if (free) {
      categoryToZone[item.category] = free;
      usedZones.add(free);
      item.zone_code = free;
      assignedCount++;
    } else {
      // 实在没空 zone
      if (unassignedCategories.indexOf(item.category) === -1) {
        unassignedCategories.push(item.category);
      }
    }
  });

  return { assignedCount, unassignedCategories, mapping: categoryToZone };
}

router.post('/api/inbound/ai-recognize', requireLogin, upload.single('file'), async function(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: '请上传图片' });
    }
    const { recognizeOrder } = require('../services/aiService');
    const base64 = req.file.buffer.toString('base64');
    const options = {};
    if (req.body.aiUrl) options.apiUrl = req.body.aiUrl;
    if (req.body.aiKey) options.apiKey = req.body.aiKey;
    if (req.body.aiModel) options.model = req.body.aiModel;

    console.log(`[AI][入库路由] 用户=${req.session.user ? req.session.user.username : '(未知)'} | 文件=${req.file.originalname || '(无名)'} ${req.file.size}B | 覆盖=${req.body.aiUrl ? 'URL ' : ''}${req.body.aiModel ? '模型 ' : ''}${req.body.aiKey ? 'Key' : ''}`);

    const result = await recognizeOrder(base64, 'inbound', options);

    // 识别成功 → 按"同类同区"规则自动分配 zone_code
    if (result && result.success && Array.isArray(result.items)) {
      try {
        const assignResult = await assignZonesByCategory(result.items, req.models);
        if (assignResult.unassignedCategories.length > 0) {
          console.log(`[AI][入库路由] ⚠️ 未分配类别: ${assignResult.unassignedCategories.join(', ')}`);
          result.warning = '以下类别未能自动分配区域（区域数量不足，请到配置中新增）：' + assignResult.unassignedCategories.join('、');
        }
        result.zoneMapping = assignResult.mapping;
      } catch (assignErr) {
        console.log(`[AI][入库路由] ❌ 自动分配 zone 失败: ${assignErr.message}`);
      }
    }

    res.json(result);
  } catch (err) {
    console.log(`[AI][入库路由] ❌ 异常: ${err.message}`);
    res.status(500).json({ success: false, error: 'AI识别失败：' + err.message });
  }
});

module.exports = router;
