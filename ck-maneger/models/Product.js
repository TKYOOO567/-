const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Product = sequelize.define('Product', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  code: {
    type: DataTypes.STRING,
    unique: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  category: {
    type: DataTypes.STRING
  },
  zone_code: {
    type: DataTypes.STRING
  },
  row_num: {
    type: DataTypes.INTEGER
  },
  col_num: {
    type: DataTypes.INTEGER
  },
  layer_num: {
    type: DataTypes.INTEGER
  },
  quantity: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  inbound_date: {
    type: DataTypes.STRING
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'in_stock'
  },
  outbound_date: {
    type: DataTypes.STRING
  },
  length: {
    type: DataTypes.FLOAT
  },
  width: {
    type: DataTypes.FLOAT
  },
  height: {
    type: DataTypes.FLOAT
  },
  created_by: {
    type: DataTypes.STRING
  }
}, {
  tableName: 'products',
  timestamps: true
});

module.exports = Product;
