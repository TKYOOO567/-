const express = require('express');
const router = express.Router();
const { getQueryPage, searchProducts, getProductDetail } = require('../controllers/queryController');
const { requireLogin } = require('../middleware/auth');

router.get('/products', requireLogin, getQueryPage);
router.get('/api/products', requireLogin, searchProducts);
router.get('/api/products/:code', requireLogin, getProductDetail);

module.exports = router;
