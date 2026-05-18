const dbManager = require('../config/dbManager');
const { createModels } = require('../models/factory');

async function dbMiddleware(req, res, next) {
  req.mainModels = {};

  if (req.session.user) {
    // 管理员访问首页时自动退出用户视角，避免权限混淆
    if (req.session.user.role === 'admin' && req.session.viewAs && req.path === '/') {
      delete req.session.viewAs;
    }

    const viewAs = req.session.viewAs || req.session.user.username;
    const sequelize = dbManager.getDbForUser(viewAs);
    const models = createModels(sequelize);
    await sequelize.sync();
    req.models = models;
    req.dbSequelize = sequelize;

    if (req.session.user.role === 'admin') {
      const mainSequelize = dbManager.getMainDb();
      const mainModels = createModels(mainSequelize);
      await mainSequelize.sync();
      req.mainModels = mainModels;
    }
  }

  next();
}

module.exports = { dbMiddleware };
