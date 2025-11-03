const PricingConfig = require('../models/PricingConfig');

module.exports = {
  Query: {
    getAllPricingConfigs: async (_, __, { user }) => {
      if (!user || user.role !== 'SUPERADMIN') {
        throw new Error('Unauthorized: Only SUPERADMIN can view pricing configurations');
      }
      // Return all including archived (client handles filtering)
      const configs = await PricingConfig.find({}).sort({ materialType: 1, vehicleType: 1, category: 1 });
      // Ensure dates are properly serialized and id is set
      return configs.map(config => {
        const obj = config.toObject();
        
        // Ensure id field is set (GraphQL expects id, not _id)
        if (!obj.id && obj._id) {
          obj.id = obj._id.toString();
        }
        
        // Ensure archive fields have defaults for older records
        if (obj.isArchived === undefined || obj.isArchived === null) {
          obj.isArchived = false;
        }
        
        // Serialize dates to ISO strings
        if (obj.scheduledDeletionDate) {
          obj.scheduledDeletionDate = obj.scheduledDeletionDate instanceof Date 
            ? obj.scheduledDeletionDate.toISOString() 
            : obj.scheduledDeletionDate;
        } else {
          obj.scheduledDeletionDate = null;
        }
        
        if (obj.archivedAt) {
          obj.archivedAt = obj.archivedAt instanceof Date 
            ? obj.archivedAt.toISOString() 
            : obj.archivedAt;
        } else {
          obj.archivedAt = null;
        }
        
        // Serialize other dates
        if (obj.createdAt instanceof Date) {
          obj.createdAt = obj.createdAt.toISOString();
        }
        if (obj.updatedAt instanceof Date) {
          obj.updatedAt = obj.updatedAt.toISOString();
        }
        
        return obj;
      });
    },

    getPricingConfigById: async (_, { id }, { user }) => {
      if (!user || user.role !== 'SUPERADMIN') {
        throw new Error('Unauthorized: Only SUPERADMIN can view pricing configurations');
      }
      return await PricingConfig.findById(id);
    },

    getPricingConfig: async (_, { materialType, vehicleType, category }, { user }) => {
      // This can be called by both superadmin and regular users for pricing calculations
      return await PricingConfig.findPricingConfig(materialType, vehicleType, category);
    },

    calculatePricingConfig: async (_, { materialType, vehicleType, category, durationMonths, adLengthSeconds, numberOfVehicles }, { user }) => {
      // This can be called by both superadmin and regular users
      const pricingConfig = await PricingConfig.findPricingConfig(materialType, vehicleType, category);
      
      if (!pricingConfig) {
        throw new Error(`No pricing configuration found for ${materialType} ${vehicleType} ${category}`);
      }

      // Validate ad length - only allow 20, 40, or 60 seconds
      const allowedAdLengths = [20, 40, 60];
      if (!allowedAdLengths.includes(adLengthSeconds)) {
        throw new Error('Ad length must be 20, 40, or 60 seconds');
      }

      // Validate duration - only allow 1-6 months
      const allowedDurations = [1, 2, 3, 4, 5, 6];
      if (!allowedDurations.includes(durationMonths)) {
        throw new Error('Duration must be 1-6 months');
      }

      // Validate number of vehicles (must be at least 1)
      if (numberOfVehicles < 1) {
        throw new Error('Number of vehicles must be at least 1');
      }

      // Calculate total price using new formula
      // Total Price = Base Price × Ad Length Multiplier × Duration (months) × Number of Vehicles × Duration Discount Multiplier
      const calculation = await pricingConfig.calculateTotalPrice(adLengthSeconds, durationMonths, numberOfVehicles);

      return {
        materialType: pricingConfig.materialType,
        vehicleType: pricingConfig.vehicleType,
        category: pricingConfig.category,
        basePrice: calculation.basePrice,
        adLengthSeconds,
        durationMonths,
        numberOfVehicles,
        adLengthMultiplier: calculation.adLengthMultiplier,
        durationDiscountMultiplier: calculation.durationDiscountMultiplier,
        subtotal: calculation.subtotal,
        discount: calculation.discount,
        totalPrice: calculation.totalPrice,
        minAdLengthSeconds: pricingConfig.minAdLengthSeconds,
        maxAdLengthSeconds: pricingConfig.maxAdLengthSeconds
      };
    }
  },

  Mutation: {
    createPricingConfig: async (_, { input }, { user }) => {
      if (!user || user.role !== 'SUPERADMIN') {
        throw new Error('Unauthorized: Only SUPERADMIN can create pricing configurations');
      }

      // Check if combination already exists
      const existing = await PricingConfig.findPricingConfig(input.materialType, input.vehicleType, input.category);
      if (existing) {
        throw new Error('Pricing configuration already exists for this combination');
      }

      // Validate base price
      if (!input.basePrice || input.basePrice <= 0) {
        throw new Error('Base price must be greater than 0');
      }

      const newConfig = new PricingConfig({
        ...input,
        materialType: input.materialType.toUpperCase(),
        vehicleType: input.vehicleType.toUpperCase(),
        category: input.category.toUpperCase(),
        createdBy: user.id
      });

      return await newConfig.save();
    },

    updatePricingConfig: async (_, { id, input }, { user }) => {
      if (!user || user.role !== 'SUPERADMIN') {
        throw new Error('Unauthorized: Only SUPERADMIN can update pricing configurations');
      }

      const existing = await PricingConfig.findById(id);
      if (!existing) {
        throw new Error('Pricing configuration not found');
      }

      // Validate base price if updating
      if (input.basePrice !== undefined && input.basePrice <= 0) {
        throw new Error('Base price must be greater than 0');
      }

      return await PricingConfig.findByIdAndUpdate(id, input, { new: true });
    },

    deletePricingConfig: async (_, { id }, { user }) => {
      if (!user || user.role !== 'SUPERADMIN') {
        throw new Error('Unauthorized: Only SUPERADMIN can delete pricing configurations');
      }

      const existing = await PricingConfig.findById(id);
      if (!existing) {
        throw new Error('Pricing configuration not found');
      }

      // Check if already archived
      if (existing.isArchived) {
        throw new Error('Pricing configuration is already archived');
      }

      console.log(`🗑️ Archiving pricing config: ${id} - 30-day deferred deletion`);

      // Soft delete: Mark as archived with 30-day deletion schedule
      const now = new Date();
      const deletionDate = new Date(now);
      deletionDate.setDate(deletionDate.getDate() + 30); // 30 days from now

      existing.isArchived = true;
      existing.archivedAt = now;
      existing.scheduledDeletionDate = deletionDate;
      existing.isActive = false; // Deactivate immediately

      await existing.save();

      console.log(`✅ Pricing config ${id} archived successfully. Scheduled for permanent deletion on: ${deletionDate.toISOString()}`);

      return 'Pricing configuration archived successfully. Scheduled for deletion in 30 days.';
    },

    restorePricingConfig: async (_, { id }, { user }) => {
      if (!user || user.role !== 'SUPERADMIN') {
        throw new Error('Unauthorized: Only SUPERADMIN can restore pricing configurations');
      }

      const existing = await PricingConfig.findById(id);
      if (!existing) {
        throw new Error('Pricing configuration not found');
      }

      if (!existing.isArchived) {
        throw new Error('Pricing configuration is not archived');
      }

      console.log(`✅ Restoring pricing config: ${id}`);

      existing.isArchived = false;
      existing.archivedAt = null;
      existing.scheduledDeletionDate = null;
      existing.isActive = true; // Re-activate when restored

      await existing.save();

      console.log(`✅ Pricing config ${id} restored successfully`);

      return 'Pricing configuration restored successfully.';
    },

    togglePricingConfigStatus: async (_, { id }, { user }) => {
      if (!user || user.role !== 'SUPERADMIN') {
        throw new Error('Unauthorized: Only SUPERADMIN can toggle pricing configuration status');
      }

      const existing = await PricingConfig.findById(id);
      if (!existing) {
        throw new Error('Pricing configuration not found');
      }

      existing.isActive = !existing.isActive;
      return await existing.save();
    }
  }
};

