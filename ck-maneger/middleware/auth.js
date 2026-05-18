function requireLogin(req, res, next) {
  if (!req.session.user) {
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ success: false, message: '请先登录' });
    }
    return res.redirect('/login');
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'admin') {
    if (req.path.startsWith('/api/')) {
      return res.status(403).json({ success: false, message: '无权限' });
    }
    return res.status(403).send('无权限访问');
  }
  next();
}

module.exports = { requireLogin, requireAdmin };
