const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const dbManager = require('../config/dbManager');
const { createModels } = require('./factory');

const mainSequelize = dbManager.getMainDb();

const User = mainSequelize.define('User', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  username: { type: DataTypes.STRING, unique: true, allowNull: false },
  password: { type: DataTypes.STRING, allowNull: false },
  role: { type: DataTypes.STRING, defaultValue: 'user' }
}, { tableName: 'users', timestamps: true });

async function initAdmin() {
  const adminCount = await User.count({ where: { role: 'admin' } });
  if (adminCount > 0) return;
  const hashedPassword = await bcrypt.hash('admin123', 10);
  await User.create({ username: 'admin', password: hashedPassword, role: 'admin' });
}

async function initUserDb(username, zonesConfig) {
  const sequelize = dbManager.getDbForUser(username);
  const { Zone } = createModels(sequelize);
  await sequelize.sync();
  if (zonesConfig && zonesConfig.length > 0) {
    await Zone.bulkCreate(zonesConfig);
  }
}

function initZonesForUser(zonesConfig, dbPath) {
  return zonesConfig;
}

module.exports = {
  User,
  initAdmin,
  initUserDb,
  mainSequelize
};
