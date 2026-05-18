const { Sequelize } = require('sequelize');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(dataDir, 'warehouse.db'),
  logging: false
});

module.exports = sequelize;

+273
-0
inbound.js
C:\Users\tky\Desktop\store_ck_2\routes\inbound.js
+14
-0
outbound.js
C:\Users\tky\Desktop\store_ck_2\routes\outbound.js
+99
-0
outbound.ejs
C:\Users\tky\Desktop\store_ck_2\views\outbound.ejs
+201
-0
inbound.ejs
C:\Users\tky\Desktop\store_ck_2\views\inbound.ejs
+198
-0
warehouse.ejs
C:\Users\tky\Desktop\stor