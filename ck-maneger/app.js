const express = require('express');
const path = require('path');
const session = require('express-session');
const { mainSequelize, initAdmin } = require('./models');
const { dbMiddleware } = require('./middleware/dbMiddleware');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: 'warehouse3d_secret_key_2026',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.viewAs = req.session.viewAs || null;
  next();
});

app.use(dbMiddleware);

// 全局 AI 请求追踪日志（用于调试）
app.use((req, res, next) => {
  if (req.path.includes('/ai-recognize')) {
    console.log(`\n[REQ] ${new Date().toISOString()} ${req.method} ${req.path}`);
    console.log(`[REQ] Cookie 是否存在: ${req.headers.cookie ? '是' : '否'}`);
    console.log(`[REQ] Session 用户: ${req.session && req.session.user ? req.session.user.username : '(未登录)'}`);
    console.log(`[REQ] Content-Type: ${req.headers['content-type']}`);
  }
  next();
});

const fs = require('fs');
const routesDir = path.join(__dirname, 'routes');
if (fs.existsSync(routesDir)) {
  const routeFiles = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));
  routeFiles.forEach(file => {
    const route = require(path.join(routesDir, file));
    app.use('/', route);
  });
}

app.use((req, res) => {
  res.status(404).render('404');
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: '服务器内部错误' });
});

async function start() {
  await mainSequelize.sync();
  await initAdmin();

  const { createModels } = require('./models/factory');
  const dbManager = require('./config/dbManager');
  const adminSequelize = dbManager.getDbForUser('admin');
  const adminModels = createModels(adminSequelize);
  await adminSequelize.sync();

  const adminZoneCount = await adminModels.Zone.count();
  if (adminZoneCount === 0) {
    const ZONE_CODES = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W'];
    const zones = ZONE_CODES.map((code, index) => {
      const row = Math.floor(index / 5);
      const col = index % 5;
      return { code, name: code + '区', rows: 3, cols: 5, layers: 4, cell_width: 1.0, cell_height: 0.8, cell_depth: 1.0, pos_x: col * 5, pos_z: row * 5 };
    });
    await adminModels.Zone.bulkCreate(zones);
  }

  app.listen(3000, () => {
    console.log('仓库管理系统已启动: http://localhost:3000');
  });
}

start();
