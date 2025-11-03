const GlobalPricingMultipliers = require('../models/GlobalPricingMultipliers');

module.exports = {
  Query: {
    getGlobalPricingMultipliers: async (_, __, { user }) => {
      if (!user || user.role !== 'SUPERADMIN') {
        throw new Error('Unauthorized: Only SUPERADMIN can view global pricing multipliers');
      }
      return await GlobalPricingMultipliers.getMultipliers();
    }
  },

  Mutation: {
    updateGlobalPricingMultipliers: async (_, { input }, { user }) => {
      if (!user || user.role !== 'SUPERADMIN') {
        throw new Error('Unauthorized: Only SUPERADMIN can update global pricing multipliers');
      }

      // Validate duration discount multipliers only (ad length multipliers are hardcoded)
      const monthsKeys = ['months1', 'months2', 'months3', 'months4', 'months5', 'months6'];
      for (const key of monthsKeys) {
        const value = input.durationDiscountMultipliers[key];
        if (!value || value <= 0 || value > 1) {
          throw new Error(`Duration discount multiplier for ${key} must be between 0 and 1`);
        }
      }

      // Ensure 1-month multiplier is 1.0 (no discount)
      if (input.durationDiscountMultipliers.months1 !== 1.0) {
        throw new Error('Duration discount multiplier for 1 month must be 1.0 (no discount)');
      }

      // Ad length multipliers are hardcoded (20s=1.0x, 40s=2.0x, 60s=3.0x)
      // Always use hardcoded values when saving
      const dbAdLengthMultipliers = {
        '20': 1.0,
        '40': 2.0,
        '60': 3.0
      };

      const dbDurationDiscountMultipliers = {
        '1': input.durationDiscountMultipliers.months1,
        '2': input.durationDiscountMultipliers.months2,
        '3': input.durationDiscountMultipliers.months3,
        '4': input.durationDiscountMultipliers.months4,
        '5': input.durationDiscountMultipliers.months5,
        '6': input.durationDiscountMultipliers.months6
      };

      // Get or create multipliers document
      let multipliers = await GlobalPricingMultipliers.findOne();
      if (!multipliers) {
        multipliers = new GlobalPricingMultipliers({
          adLengthMultipliers: dbAdLengthMultipliers,
          durationDiscountMultipliers: dbDurationDiscountMultipliers,
          updatedBy: user.id
        });
      } else {
        // Always use hardcoded ad length multipliers
        multipliers.adLengthMultipliers = dbAdLengthMultipliers;
        multipliers.durationDiscountMultipliers = dbDurationDiscountMultipliers;
        multipliers.updatedBy = user.id;
        multipliers.updatedAt = new Date();
      }

      return await multipliers.save();
    }
  },

  // Field resolvers to map database keys to GraphQL field names
  // Ad length multipliers are hardcoded (20s=1.0x, 40s=2.0x, 60s=3.0x)
  AdLengthMultipliers: {
    seconds20: () => 1.0,
    seconds40: () => 2.0,
    seconds60: () => 3.0
  },

  DurationDiscountMultipliers: {
    months1: (parent) => {
      // parent is the durationDiscountMultipliers object from the database with keys '1', '2', '3', etc.
      return parent['1'] ?? 1.0;
    },
    months2: (parent) => parent['2'] ?? 0.95,
    months3: (parent) => parent['3'] ?? 0.95,
    months4: (parent) => parent['4'] ?? 0.90,
    months5: (parent) => parent['5'] ?? 0.90,
    months6: (parent) => parent['6'] ?? 0.85
  }
};

