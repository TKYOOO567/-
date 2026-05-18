const { DataTypes } = require('sequelize');

function createModels(sequelize) {
  const Zone = sequelize.define('Zone', {
    code: { type: DataTypes.STRING, primaryKey: true },
    name: { type: DataTypes.STRING },
    rows: { type: DataTypes.INTEGER, defaultValue: 3 },
    cols: { type: DataTypes.INTEGER, defaultValue: 5 },
    layers: { type: DataTypes.INTEGER, defaultValue: 4 },
    cell_width: { type: DataTypes.FLOAT, defaultValue: 1.0 },
    cell_height: { type: DataTypes.FLOAT, defaultValue: 0.8 },
    cell_depth: { type: DataTypes.FLOAT, defaultValue: 1.0 },
    pos_x: { type: DataTypes.FLOAT, defaultValue: 0 },
    pos_z: { type: DataTypes.FLOAT, defaultValue: 0 }
  }, { tableName: 'zones', timestamps: false });

  const Product = sequelize.define('Product', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    code: { type: DataTypes.STRING, unique: true },
    name: { type: DataTypes.STRING, allowNull: false },
    category: { type: DataTypes.STRING },
    zone_code: { type: DataTypes.STRING },
    row_num: { type: DataTypes.INTEGER },
    col_num: { type: DataTypes.INTEGER },
    layer_num: { type: DataTypes.INTEGER },
    quantity: { type: DataTypes.INTEGER, defaultValue: 1 },
    inbound_date: { type: DataTypes.STRING },
    status: { type: DataTypes.STRING, defaultValue: 'in_stock' },
    outbound_date: { type: DataTypes.STRING },
    length: { type: DataTypes.FLOAT },
    width: { type: DataTypes.FLOAT },
    height: { type: DataTypes.FLOAT },
    created_by: { type: DataTypes.STRING }
  }, { tableName: 'products', timestamps: true });

  const WarehouseConfig = sequelize.define('WarehouseConfig', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    key: { type: DataTypes.STRING, unique: true },
    value: { type: DataTypes.TEXT }
  }, { tableName: 'warehouse_configs', timestamps: false });

  Product.belongsTo(Zone, { foreignKey: 'zone_code', targetKey: 'code' });
  Zone.hasMany(Product, { foreignKey: 'zone_code', sourceKey: 'code' });

  return { Zone, Product, WarehouseConfig, sequelize };
}

module.exports = { createModels };
