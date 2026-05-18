const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const upload = multer({ storage: multer.memoryStorage() });
const { getOutboundPage, processOutbound, processOutboundExcel } = require('../controllers/outboundController');
const { requireLogin } = require('../middleware/auth');

router.get('/outbound', requireLogin, getOutboundPage);
router.post('/api/outbound', requireLogin, processOutbound);
router.post('/api/outbound/excel', requireLogin, upload.single('file'), processOutboundExcel);
router.get('/api/outbound/template', requireLogin, function(req, res) {
  const headers = ['商品编码'];
  const example = ['A-1-3-2-20260101-0001'];
  const ws = XLSX.utils.aoa_to_sheet([headers, example]);
  ws['!cols'] = [{ wch: 30 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '出库模板');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', 'attachment; filename=outbound_template.xlsx');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
});

router.post('/api/outbound/ai-recognize', requireLogin, upload.single('file'), async function(req, res) {
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

    console.log(`[AI][出库路由] 用户=${req.session.user ? req.session.user.username : '(未知)'} | 文件=${req.file.originalname || '(无名)'} ${req.file.size}B | 覆盖=${req.body.aiUrl ? 'URL ' : ''}${req.body.aiModel ? '模型 ' : ''}${req.body.aiKey ? 'Key' : ''}`);

    const result = await recognizeOrder(base64, 'outbound', options);
    res.json(result);
  } catch (err) {
    console.log(`[AI][出库路由] ❌ 异常: ${err.message}`);
    res.status(500).json({ success: false, error: 'AI识别失败：' + err.message });
  }
});

const pathfindResults = {};
let pathfindIdCounter = 0;

router.post('/api/outbound/pathfind', requireLogin, async function(req, res) {
  try {
    const { codes } = req.body;
    if (!codes || codes.length === 0) {
      return res.status(400).json({ success: false, error: '请提供商品编码列表' });
    }

    const { Zone, Product, WarehouseConfig } = req.models;
    const { buildWarehouseGrid, findOptimalRoute, worldPathToSegment } = require('../services/pathfinding');

    // 从数据库读取出口位置配置
    const exitXConfig = await WarehouseConfig.findOne({ where: { key: 'exit_pos_x' } });
    const exitZConfig = await WarehouseConfig.findOne({ where: { key: 'exit_pos_z' } });
    const exitX = exitXConfig ? parseFloat(exitXConfig.value) : 0;
    const exitZ = exitZConfig ? parseFloat(exitZConfig.value) : 0;
    const startWorld = { x: exitX, z: exitZ };

    const zones = await Zone.findAll({ raw: true });
    if (zones.length === 0) {
      return res.status(400).json({ success: false, error: '暂无仓库区域配置' });
    }

    const gridData = buildWarehouseGrid(zones);

    const targetCells = [];
    const unreachableCodes = [];

    for (const code of codes) {
      const product = await Product.findOne({ where: { code } });
      if (!product) {
        unreachableCodes.push({ code, reason: '编码不存在' });
        continue;
      }
      const zone = zones.find(z => z.code === product.zone_code);
      if (!zone) {
        unreachableCodes.push({ code, reason: '区域不存在' });
        continue;
      }
      const worldX = (zone.pos_x || 0) + (product.col_num - 0.5) * zone.cell_width;
      const worldZ = (zone.pos_z || 0) + (product.row_num - 0.5) * zone.cell_depth;
      targetCells.push({
        zone_code: product.zone_code,
        row_num: product.row_num,
        col_num: product.col_num,
        layer_num: product.layer_num,
        productName: product.name,
        code: product.code,
        worldX,
        worldZ
      });
    }

    if (targetCells.length === 0) {
      return res.json({ success: true, worldPath: { fullPath: [], segments: [] }, order: [], segments: [], fullPath: [], targetCells: [], exitPos: { x: exitX, z: exitZ }, unreachable: unreachableCodes });
    }

    const result = findOptimalRoute(gridData, targetCells, startWorld);
    const worldPath = worldPathToSegment(result.fullPath, result.segments, gridData);
    const batchId = String(++pathfindIdCounter);
    pathfindResults[batchId] = { result, worldPath, targetCells, zones, order: result.order };

    setTimeout(function() { delete pathfindResults[batchId]; }, 30 * 60 * 1000);

    res.json({
      success: true,
      batchId,
      order: result.order,
      fullPath: worldPath.fullPath,
      segments: worldPath.segments,
      targetCells,
      unreachable: unreachableCodes,
      exitPos: { x: exitX, z: exitZ }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: '路径规划失败：' + err.message });
  }
});

router.get('/api/outbound/pathfind/:batchId', requireLogin, function(req, res) {
  const result = pathfindResults[req.params.batchId];
  if (!result) {
    return res.status(404).json({ success: false, error: '路径数据已过期或不存在' });
  }
  res.json({ success: true, ...result });
});

module.exports = router;
