const { Product, Zone } = require('../models');
const { Op } = require('sequelize');

async function getQueryPage(req, res) {
  const { Zone } = req.models;
  const zones = await Zone.findAll({ order: [['code', 'ASC']] });
  res.render('query', { zones, activePage: 'products' });
}

async function searchProducts(req, res) {
  const { Product, Zone } = req.models;
  const { code, name, zone, status, page: pageParam, limit: limitParam } = req.query;

  const where = {};
  if (code) where.code = code;
  if (name) where.name = { [Op.like]: '%' + name + '%' };
  if (zone) where.zone_code = zone;
  if (status) where.status = status;

  const isAdmin = req.session.user && req.session.user.role === 'admin';
  if (!isAdmin && !req.session.viewAs) {
    where.created_by = req.session.user.username;
  }

  const page = parseInt(pageParam) || 1;
  const limit = parseInt(limitParam) || 20;
  const offset = (page - 1) * limit;

  const { count, rows } = await Product.findAndCountAll({
    where,
    include: [{ model: Zone, attributes: ['code', 'name'] }],
    order: [['inbound_date', 'DESC']],
    limit, offset
  });

  res.json({ success: true, data: rows, total: count, page, totalPages: Math.ceil(count / limit) });
}

async function getProductDetail(req, res) {
  const { Product, Zone } = req.models;
  const { code } = req.params;
  const product = await Product.findOne({
    where: { code },
    include: [{ model: Zone, attributes: ['code', 'name', 'rows', 'cols', 'layers'] }]
  });
  if (!product) return res.status(404).json({ success: false, message: '商品不存在' });
  res.json({ success: true, data: product });
}

module.exports = { getQueryPage, searchProducts, getProductDetail };
