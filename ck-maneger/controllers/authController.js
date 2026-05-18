const bcrypt = require('bcryptjs');
const { User } = require('../models');

async function getLoginPage(req, res) {
  if (req.session.user) {
    return res.redirect('/');
  }
  res.render('login', { error: null });
}

async function login(req, res) {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.render('login', { error: '请输入用户名和密码' });
  }

  const user = await User.findOne({ where: { username } });
  if (!user) {
    return res.render('login', { error: '用户名或密码错误' });
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return res.render('login', { error: '用户名或密码错误' });
  }

  req.session.user = { id: user.id, username: user.username, role: user.role };
  delete req.session.viewAs;
  res.redirect('/');
}

async function logout(req, res) {
  req.session.destroy();
  res.redirect('/login');
}

module.exports = { getLoginPage, login, logout };
