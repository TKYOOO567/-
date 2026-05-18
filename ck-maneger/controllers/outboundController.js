const { Product } = require('../models');
const XLSX = require('xlsx');

function getOutboundPage(req, res) {
  res.render('outbound');
}

async function processOutbound(req, res) {
  const { Product } = req.models;
  const { codes } = req.body;

  if (!codes || !codes.trim()) {
    return res.status(400).json({ success: false, message: '请输入商品编码' });
  }

  const codeList = codes
    .split(/[,\n]+/)
    .map(c => c.trim())
    .filter(c => c.length > 0);

  if (codeList.length === 0) {
    return res.status(400).json({ success: false, message: '请输入有效的商品编码' });
  }

  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const outboundDate = `${y}${m}${d}`;

  const processed = [];
  const errors = [];

  for (const code of codeList) {
    const product = await Product.findOne({ where: { code } });

    if (!product) {
      errors.push({ code, message: `编码 ${code} 不存在` });
      continue;
    }

    if (product.status === 'out') {
      errors.push({ code, message: `编码 ${code} 已出库` });
      continue;
    }

    const isAdmin = req.session.user && req.session.user.role === 'admin';
    if (!isAdmin && product.created_by && product.created_by !== req.session.user.username) {
      errors.push({ code, message: `编码 ${code} 不属于您，无法出库` });
      continue;
    }

    product.status = 'out';
    product.outbound_date = outboundDate;
    await product.save();
    processed.push(code);
  }

  res.json({ success: true, processed, errors });
}

async function processOutboundExcel(req, res) {
  try {
    const { Product } = req.models;

    if (!req.file) {
      return res.status(400).json({ success: false, error: '请上传Excel文件' });
    }

    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
    if (rows.length < 2) {
      return res.status(400).json({ success: false, error: 'Excel文件无数据行' });
    }

    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const outboundDate = `${y}${m}${d}`;

    const isAdmin = req.session.user && req.session.user.role === 'admin';
    const username = req.session.user ? req.session.user.username : null;

    const results = [];
    const errors = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || (!row[0] && row[0] !== 0)) continue;

      const code = String(row[0] || '').trim();

      if (!code) {
        errors.push({ row: i + 1, name: '(空)', message: '商品编码不能为空' });
        continue;
      }

      const product = await Product.findOne({ where: { code } });

      if (!product) {
        errors.push({ row: i + 1, name: code, message: `编码 ${code} 不存在` });
        continue;
      }

      if (product.status === 'out') {
        errors.push({ row: i + 1, name: product.name, message: `编码 ${code} 已出库` });
        continue;
      }

      if (!isAdmin && product.created_by && product.created_by !== username) {
        errors.push({ row: i + 1, name: product.name, message: `编码 ${code} 不属于您，无法出库` });
        continue;
      }

      product.status = 'out';
      product.outbound_date = outboundDate;
      await product.save();
      results.push({ row: i + 1, name: product.name, code: code });
    }

    res.json({
      success: true,
      total: rows.length - 1,
      successCount: results.length,
      errorCount: errors.length,
      results,
      errors
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: '文件解析失败：' + err.message });
  }
}

module.exports = { getOutboundPage, processOutbound, processOutboundExcel };
