const homeController = {
  getHomePage: async (req, res) => {
    const { Product, Zone } = req.models;
    const inStockCount = await Product.count({ where: { status: 'in_stock' } });
    const outStockCount = await Product.count({ where: { status: 'out' } });
    const zoneCount = await Zone.count();
    res.render('index', { inStockCount, outStockCount, zoneCount });
  }
};

module.exports = homeController;
