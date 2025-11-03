const mongoose = require('mongoose');

const globalPricingMultipliersSchema = new mongoose.Schema({
  // Ad Length Multipliers (fixed values)
  adLengthMultipliers: {
    '20': {
      type: Number,
      default: 1.0,
      required: true
    },
    '40': {
      type: Number,
      default: 2.0,
      required: true
    },
    '60': {
      type: Number,
      default: 3.0,
      required: true
    }
  },

  // Duration Discount Multipliers (1-6 months)
  durationDiscountMultipliers: {
    '1': { // 1 month
      type: Number,
      default: 1.0,
      required: true
    },
    '2': { // 2 months
      type: Number,
      default: 0.95,
      required: true
    },
    '3': { // 3 months
      type: Number,
      default: 0.95,
      required: true
    },
    '4': { // 4 months
      type: Number,
      default: 0.90,
      required: true
    },
    '5': { // 5 months
      type: Number,
      default: 0.90,
      required: true
    },
    '6': { // 6 months
      type: Number,
      default: 0.85,
      required: true
    }
  },

  // Metadata
  updatedBy: {
    type: String,
    required: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Ensure only one document exists (singleton pattern)
globalPricingMultipliersSchema.statics.getMultipliers = async function() {
  let multipliers = await this.findOne();
  if (!multipliers) {
    // Create default multipliers if none exist
    multipliers = new this({
      updatedBy: 'system'
    });
    await multipliers.save();
  }
  return multipliers;
};

module.exports = mongoose.model('GlobalPricingMultipliers', globalPricingMultipliersSchema);

