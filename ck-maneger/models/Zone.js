const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Zone = sequelize.define('Zone', {
  code: {
    type: DataTypes.STRING,
    primaryKey: true,
    validate: {
      isIn: [['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W']]
    }
  },
  name: {
    type: DataTypes.STRING
  },
  rows: {
    type: DataTypes.INTEGER,
    defaultValue: 3
  },
  cols: {
    type: DataTypes.INTEGER,
    defaultValue: 5
  },
  layers: {
    type: DataTypes.INTEGER,
    defaultValue: 4
  },
  cell_width: {
    type: DataTypes.FLOAT,
    defaultValue: 1.0
  },
  cell_height: {
    type: DataTypes.FLOAT,
    defaultValue: 0.8
  },
  cell_depth: {
    type: DataTypes.FLOAT,
    defaultValue: 1.0
  },
  pos_x: {
    type: DataTypes.FLOAT,
    defaultValue: 0
  },
  pos_z: {
    type: DataTypes.FLOAT,
    defaultValue: 0
  }
}, {
  tableName: 'zones',
  timestamps: false
});

module.exports = Zone;
