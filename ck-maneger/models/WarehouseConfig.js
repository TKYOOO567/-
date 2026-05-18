const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const WarehouseConfig = sequelize.define('WarehouseConfig', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  key: {
    type: DataTypes.STRING,
    unique: true
  },
  value: {
    type: DataTypes.TEXT
  }
}, {
  tableName: 'warehouse_configs',
  timestamps: false
});

module.exports = WarehouseConfig;
