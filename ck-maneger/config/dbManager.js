const { Sequelize } = require('sequelize');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const mainSequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(dataDir, 'warehouse.db'),
  logging: false
});

const dbCache = {};

function getUserDbPath(username) {
  return path.join(dataDir, 'warehouse_' + username + '.db');
}

function getConnection(dbPath) {
  if (!dbCache[dbPath]) {
    dbCache[dbPath] = new Sequelize({
      dialect: 'sqlite',
      storage: dbPath,
      logging: false
    });
  }
  return dbCache[dbPath];
}

function getMainDb() {
  return mainSequelize;
}

function getDbForUser(username) {
  const dbPath = getUserDbPath(username);
  return getConnection(dbPath);
}

function dbExists(username) {
  return fs.existsSync(getUserDbPath(username));
}

module.exports = {
  getMainDb,
  getDbForUser,
  getUserDbPath,
  dbExists,
  dataDir
};
