const { createModels } = require('../models/factory');
const { User, initUserDb } = require('../models');
const dbManager = require('../config/dbManager');

async function getWarehousePage(req, res) {
  res.render('warehouse');
}

async function getWarehouseLayout(req, res) {
  const { Zone, Product, WarehouseConfig } = req.models;
  const zones = await Zone.findAll({ order: [['code', 'ASC']], raw: true });
  const isAdmin = req.session.user && req.session.user.role === 'admin';
  const where = {};
  if (!isAdmin) {
    where.created_by = req.session.user.username;
  }
  const products = await Product.findAll({ where, raw: true });
  const configs = await WarehouseConfig.findAll({ raw: true });
  const configMap = {};
  configs.forEach(c => { configMap[c.key] = c.value; });
  res.json({ zones, products, config: configMap });
}

async function getConfigPage(req, res) {
  const { Zone, WarehouseConfig } = req.models;
  const zones = await Zone.findAll({ order: [['code', 'ASC']] });
  const configs = await WarehouseConfig.findAll();
  const configMap = {};
  configs.forEach(c => { configMap[c.key] = c.value; });
  res.render('config', {
    zones,
    configs: configMap,
    exitPosX: configMap.exit_pos_x || 0,
    exitPosZ: configMap.exit_pos_z || 0
  });
}

async function getAllZones(req, res) {
  const { Zone } = req.models;
  const zones = await Zone.findAll({ order: [['code', 'ASC']] });
  res.json(zones);
}

async function updateZone(req, res) {
  const { Zone, Product } = req.models;
  const { code } = req.params;
  const { rows, cols, layers, cell_width, cell_height, cell_depth } = req.body;

  const zone = await Zone.findByPk(code);
  if (!zone) return res.status(404).json({ error: 'Zone not found' });

  const productsWithConflict = await Product.findAll({ where: { zone_code: code } });
  const newRows = parseInt(rows);
  const newCols = parseInt(cols);
  const newLayers = parseInt(layers);
  const hasConflict = productsWithConflict.some(p => {
    return (p.row_num != null && p.row_num > newRows) ||
           (p.col_num != null && p.col_num > newCols) ||
           (p.layer_num != null && p.layer_num > newLayers);
  });

  zone.rows = newRows;
  zone.cols = newCols;
  zone.layers = newLayers;
  zone.cell_width = parseFloat(cell_width);
  zone.cell_height = parseFloat(cell_height);
  zone.cell_depth = parseFloat(cell_depth);
  await zone.save();
  const result = zone.toJSON();
  if (hasConflict) result.hasConflict = true;
  res.json(result);
}

async function updateWarehouseSize(req, res) {
  const { WarehouseConfig } = req.models;
  const { warehouse_width, warehouse_height, warehouse_depth, exit_pos_x, exit_pos_z } = req.body;
  await WarehouseConfig.upsert({ key: 'warehouse_width', value: String(warehouse_width) });
  await WarehouseConfig.upsert({ key: 'warehouse_height', value: String(warehouse_height) });
  await WarehouseConfig.upsert({ key: 'warehouse_depth', value: String(warehouse_depth) });
  if (exit_pos_x !== undefined) {
    await WarehouseConfig.upsert({ key: 'exit_pos_x', value: String(exit_pos_x) });
  }
  if (exit_pos_z !== undefined) {
    await WarehouseConfig.upsert({ key: 'exit_pos_z', value: String(exit_pos_z) });
  }
  const configs = await WarehouseConfig.findAll();
  const configMap = {};
  configs.forEach(c => { configMap[c.key] = c.value; });
  res.json(configMap);
}

async function getUserManagementPage(req, res) {
  const users = await User.findAll({ where: { role: 'user' }, order: [['username', 'ASC']] });
  res.render('admin_users', { users });
}

async function createUser(req, res) {
  const bcrypt = require('bcryptjs');
  const { username, password, zones } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, error: '用户名和密码不能为空' });
  }
  const existing = await User.findOne({ where: { username } });
  if (existing) {
    return res.status(400).json({ success: false, error: '用户名已存在' });
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  await User.create({ username, password: hashedPassword, role: 'user' });

  const zonesConfig = zones && zones.length > 0 ? zones : [];
  await initUserDb(username, zonesConfig);

  res.json({ success: true, message: '用户创建成功' });
}

async function switchWarehouse(req, res) {
  const { targetUser } = req.body;
  if (req.session.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: '无权限' });
  }
  if (targetUser === 'admin') {
    delete req.session.viewAs;
  } else {
    const user = await User.findOne({ where: { username: targetUser, role: 'user' } });
    if (!user) {
      return res.status(400).json({ success: false, error: '用户不存在' });
    }
    if (!dbManager.dbExists(targetUser)) {
      return res.status(400).json({ success: false, error: '该用户仓库尚未初始化' });
    }
    req.session.viewAs = targetUser;
  }
  res.json({ success: true });
}

async function exitViewAs(req, res) {
  if (req.session.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: '无权限' });
  }
  delete req.session.viewAs;
  res.json({ success: true });
}

async function getAdminLayout(req, res) {
  const { targetUser } = req.query;
  if (req.session.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: '无权限' });
  }
  if (!targetUser) {
    return res.status(400).json({ success: false, error: '缺少目标用户名' });
  }
  const sequelize = dbManager.getDbForUser(targetUser);
  const { Zone, Product, WarehouseConfig } = createModels(sequelize);
  await sequelize.sync();

  const zones = await Zone.findAll({ order: [['code', 'ASC']], raw: true });
  const products = await Product.findAll({ raw: true });
  const configs = await WarehouseConfig.findAll({ raw: true });
  const configMap = {};
  configs.forEach(c => { configMap[c.key] = c.value; });
  res.json({ zones, products, config: configMap });
}

async function editUser(req, res) {
  const { username } = req.params;
  const { password, zones, warehouse_width, warehouse_height, warehouse_depth } = req.body;

  const user = await User.findOne({ where: { username, role: 'user' } });
  if (!user) {
    return res.status(404).json({ success: false, error: '用户不存在' });
  }

  if (password) {
    const bcrypt = require('bcryptjs');
    user.password = await bcrypt.hash(password, 10);
    await user.save();
  }

  if (!dbManager.dbExists(username)) {
    return res.json({ success: true, message: '密码已更新（该用户仓库尚未初始化）' });
  }

  const sequelize = dbManager.getDbForUser(username);
  const { Zone, WarehouseConfig } = createModels(sequelize);

  if (zones && zones.length > 0) {
    const existingZones = await Zone.findAll();
    const existingCodes = existingZones.map(z => z.code);
    const newCodes = zones.map(z => z.code);

    for (const zoneData of zones) {
      const existing = existingZones.find(z => z.code === zoneData.code);
      if (existing) {
        await existing.update(zoneData);
      } else {
        await Zone.create(zoneData);
      }
    }

    const codesToRemove = existingCodes.filter(c => !newCodes.includes(c));
    if (codesToRemove.length > 0) {
      await Zone.destroy({ where: { code: codesToRemove } });
    }
  }

  if (warehouse_width) {
    await WarehouseConfig.upsert({ key: 'warehouse_width', value: String(warehouse_width) });
  }
  if (warehouse_height) {
    await WarehouseConfig.upsert({ key: 'warehouse_height', value: String(warehouse_height) });
  }
  if (warehouse_depth) {
    await WarehouseConfig.upsert({ key: 'warehouse_depth', value: String(warehouse_depth) });
  }

  res.json({ success: true, message: '用户信息已更新' });
}

async function deleteUser(req, res) {
   const fs = require('fs');
   const { username } = req.params;

   const user = await User.findOne({ where: { username, role: 'user' } });
   if (!user) {
     return res.status(404).json({ success: false, error: '用户不存在' });
   }

   await user.destroy();

   const dbPath = dbManager.getUserDbPath(username);
   if (fs.existsSync(dbPath)) {
     fs.unlinkSync(dbPath);
   }

   res.json({ success: true, message: '用户已删除' });
 }

module.exports = {
  getWarehousePage, getWarehouseLayout, getConfigPage,
  getAllZones, updateZone, updateWarehouseSize,
  getUserManagementPage, createUser, switchWarehouse,
  getAdminLayout, editUser, deleteUser, exitViewAs
};
