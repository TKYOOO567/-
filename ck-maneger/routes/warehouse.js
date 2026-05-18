const express = require('express');
const router = express.Router();
const warehouseController = require('../controllers/warehouseController');
const { requireLogin, requireAdmin } = require('../middleware/auth');

router.get('/warehouse', requireLogin, warehouseController.getWarehousePage);
router.get('/config', requireLogin, requireAdmin, warehouseController.getConfigPage);
router.get('/api/warehouse/layout', requireLogin, warehouseController.getWarehouseLayout);
router.get('/api/zones', requireLogin, warehouseController.getAllZones);
router.put('/api/zones/:code', requireLogin, requireAdmin, warehouseController.updateZone);
router.put('/api/config/warehouse-size', requireLogin, requireAdmin, warehouseController.updateWarehouseSize);
router.get('/admin/users', requireLogin, requireAdmin, warehouseController.getUserManagementPage);
router.post('/api/admin/users', requireLogin, requireAdmin, warehouseController.createUser);
router.put('/api/admin/users/:username', requireLogin, requireAdmin, warehouseController.editUser);
router.delete('/api/admin/users/:username', requireLogin, requireAdmin, warehouseController.deleteUser);
router.post('/api/admin/switch', requireLogin, requireAdmin, warehouseController.switchWarehouse);
router.post('/api/admin/exit-view', requireLogin, requireAdmin, warehouseController.exitViewAs);
router.get('/api/admin/layout', requireLogin, requireAdmin, warehouseController.getAdminLayout);

module.exports = router;
