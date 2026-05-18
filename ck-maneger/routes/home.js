const express = require('express');
const router = express.Router();
const { getHomePage } = require('../controllers/homeController');
const { requireLogin } = require('../middleware/auth');

router.get('/', requireLogin, getHomePage);

module.exports = router;
