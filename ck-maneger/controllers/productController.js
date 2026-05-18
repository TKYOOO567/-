const XLSX = require('xlsx');
const dbManager = require('../config/dbManager');
const { createModels } = require('../models/factory');

function pad2(n) { return String(n).padStart(2, '0'); }

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;
}

async function getInboundPage(req, res) {
  const { Zone } = req.models;
  const zones = await Zone.findAll({ order: [['code', 'ASC']], raw: true });
  res.render('inbound', { zones });
}

async function generateCode(Product, zone_code, row_num, col_num, layer_num, dateStr) {
  const prefix = `${zone_code}-${pad2(row_num)}-${pad2(col_num)}-${pad2(layer_num)}-${dateStr}-`;
  const existing = await Product.findOne({
    where: { zone_code, row_num, col_num, layer_num, inbound_date: dateStr },
    order: [['code', 'DESC']]
  });
  let serialNum = 1;
  if (existing && existing.code) {
    const parts = existing.code.split('-');
    const lastPart = parts[parts.length - 1];
    const num = parseInt(lastPart, 10);
    if (!isNaN(num)) serialNum = num + 1;
  }
  return prefix + String(serialNum).padStart(4, '0');
}

async function createInbound(req, res) {
  try {
    const { Zone, Product } = req.models;
    const { name, category, zone_code, row_num, col_num, layer_num, quantity, length, width, height } = req.body;

    if (!name || !zone_code || row_num == null || col_num == null || layer_num == null) {
      return res.status(400).json({ success: false, error: '请填写所有必填字段' });
    }

    const zone = await Zone.findByPk(zone_code);
    if (!zone) return res.status(400).json({ success: false, error: '区域编码不存在' });

    const r = parseInt(row_num, 10);
    const c = parseInt(col_num, 10);
    const l = parseInt(layer_num, 10);
    const q = parseInt(quantity, 10) || 1;

    if (r < 1 || r > zone.rows) return res.status(400).json({ success: false, error: `排号超出范围（1-${zone.rows}）` });
    if (c < 1 || c > zone.cols) return res.status(400).json({ success: false, error: `列号超出范围（1-${zone.cols}）` });
    if (l < 1 || l > zone.layers) return res.status(400).json({ success: false, error: `层号超出范围（1-${zone.layers}）` });

    const dateStr = todayStr();
    const code = await generateCode(Product, zone_code, r, c, l, dateStr);

    const product = await Product.create({
      code, name, category: category || '', zone_code, row_num: r, col_num: c, layer_num: l,
      quantity: q, inbound_date: dateStr, status: 'in_stock',
      length: length ? parseFloat(length) : null,
      width: width ? parseFloat(width) : null,
      height: height ? parseFloat(height) : null,
      created_by: req.session.user ? req.session.user.username : null
    });

    return res.json({ success: true, product: product.toJSON() });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ success: false, error: '商品编码已存在，请重试' });
    }
    return res.status(500).json({ success: false, error: '服务器错误：' + err.message });
  }
}

async function getZoneDetail(req, res) {
  const { Zone } = req.models;
  const zone = await Zone.findByPk(req.params.code, { raw: true });
  if (!zone) return res.status(404).json({ success: false, error: '区域不存在' });
  return res.json({ success: true, zone });
}

function downloadTemplate(req, res) {
  const headers = ['商品名称', '分类', '区域', '排号', '列号', '层号', '数量', '长(cm)', '宽(cm)', '高(cm)'];
  const example = ['示例商品', '电子产品', 'A', '1', '1', '1', '10', '50', '40', '30'];
  const ws = XLSX.utils.aoa_to_sheet([headers, example]);
  ws['!cols'] = headers.map(() => ({ wch: 15 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '入库模板');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', 'attachment; filename=inbound_template.xlsx');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
}

async function importExcel(req, res) {
  try {
    const { Zone, Product } = req.models;
    if (!req.file) return res.status(400).json({ success: false, error: '请上传Excel文件' });

    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
    if (rows.length < 2) return res.status(400).json({ success: false, error: 'Excel文件无数据行' });

    const dateStr = todayStr();
    const zones = await Zone.findAll({ raw: true });
    const zoneMap = {};
    zones.forEach(z => { zoneMap[z.code] = z; });

    const results = [];
    const errors = [];
    const username = req.session.user ? req.session.user.username : null;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !row[0]) continue;
      const name = String(row[0] || '').trim();
      const category = String(row[1] || '').trim();
      const zone_code = String(row[2] || '').trim();
      const row_num = parseInt(row[3]);
      const col_num = parseInt(row[4]);
      const layer_num = parseInt(row[5]);
      const quantity = parseInt(row[6]) || 1;
      const length = parseFloat(row[7]) || null;
      const width = parseFloat(row[8]) || null;
      const height = parseFloat(row[9]) || null;

      const rowErr = [];
      if (!name) rowErr.push('商品名称不能为空');
      if (!zoneMap[zone_code]) rowErr.push(`区域 ${zone_code} 不存在`);
      else {
        const z = zoneMap[zone_code];
        if (isNaN(row_num) || row_num < 1 || row_num > z.rows) rowErr.push(`排号超出范围（1-${z.rows}）`);
        if (isNaN(col_num) || col_num < 1 || col_num > z.cols) rowErr.push(`列号超出范围（1-${z.cols}）`);
        if (isNaN(layer_num) || layer_num < 1 || layer_num > z.layers) rowErr.push(`层号超出范围（1-${z.layers}）`);
      }

      if (rowErr.length > 0) {
        errors.push({ row: i + 1, name: name || '(空)', message: rowErr.join('；') });
        continue;
      }

      try {
        const code = await generateCode(Product, zone_code, row_num, col_num, layer_num, dateStr);
        const product = await Product.create({
          code, name, category, zone_code, row_num, col_num, layer_num,
          quantity, inbound_date: dateStr, status: 'in_stock',
          length, width, height, created_by: username
        });
        results.push({ row: i + 1, name, code: product.code });
      } catch (err) {
        errors.push({ row: i + 1, name, message: err.message });
      }
    }

    res.json({ success: true, total: rows.length - 1, successCount: results.length, errorCount: errors.length, results, errors });
  } catch (err) {
    return res.status(500).json({ success: false, error: '文件解析失败：' + err.message });
  }
}

module.exports = { getInboundPage, createInbound, getZoneDetail, downloadTemplate, importExcel };
