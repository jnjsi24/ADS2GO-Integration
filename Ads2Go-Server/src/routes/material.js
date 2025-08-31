const express = require('express');
const router = express.Router();
const Material = require('../models/Material');

// GET /material - Get all materials
router.get('/', async (req, res) => {
  try {
    const { materialType, category, isActive } = req.query;
    
    let query = {};
    
    if (materialType) query.materialType = materialType;
    if (category) query.category = category;
    if (isActive !== undefined) {
      // For active materials, we consider them active if they have a driverId (mounted)
      if (isActive === 'true') {
        query.driverId = { $ne: null };
      } else {
        query.driverId = null;
      }
    }

    const materials = await Material.find(query)
      .populate('driver', 'driverId firstName lastName')
      .sort({ createdAt: -1 });

    // Transform the data to match the frontend interface
    const transformedMaterials = materials.map(material => ({
      _id: material._id,
      materialId: material.materialId,
      materialType: material.materialType,
      title: `${material.materialType} - ${material.vehicleType}`,
      description: material.description || `${material.materialType} material for ${material.vehicleType}`,
      isActive: !!material.driverId,
      createdAt: material.createdAt,
      updatedAt: material.updatedAt,
      driver: material.driver,
      vehicleType: material.vehicleType,
      category: material.category
    }));

    res.json({
      success: true,
      materials: transformedMaterials,
      total: transformedMaterials.length
    });

  } catch (error) {
    console.error('Error fetching materials:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// GET /material/:materialId - Get specific material
router.get('/:materialId', async (req, res) => {
  try {
    const { materialId } = req.params;

    const material = await Material.findOne({ materialId })
      .populate('driver', 'driverId firstName lastName');

    if (!material) {
      return res.status(404).json({
        success: false,
        message: 'Material not found'
      });
    }

    const transformedMaterial = {
      _id: material._id,
      materialId: material.materialId,
      materialType: material.materialType,
      title: `${material.materialType} - ${material.vehicleType}`,
      description: material.description || `${material.materialType} material for ${material.vehicleType}`,
      isActive: !!material.driverId,
      createdAt: material.createdAt,
      updatedAt: material.updatedAt,
      driver: material.driver,
      vehicleType: material.vehicleType,
      category: material.category
    };

    res.json({
      success: true,
      material: transformedMaterial
    });

  } catch (error) {
    console.error('Error fetching material:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// GET /material/active - Get only active materials (mounted)
router.get('/active', async (req, res) => {
  try {
    const materials = await Material.find({ driverId: { $ne: null } })
      .populate('driver', 'driverId firstName lastName')
      .sort({ createdAt: -1 });

    const transformedMaterials = materials.map(material => ({
      _id: material._id,
      materialId: material.materialId,
      materialType: material.materialType,
      title: `${material.materialType} - ${material.vehicleType}`,
      description: material.description || `${material.materialType} material for ${material.vehicleType}`,
      isActive: true,
      createdAt: material.createdAt,
      updatedAt: material.updatedAt,
      driver: material.driver,
      vehicleType: material.vehicleType,
      category: material.category
    }));

    res.json({
      success: true,
      materials: transformedMaterials,
      total: transformedMaterials.length
    });

  } catch (error) {
    console.error('Error fetching active materials:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;
