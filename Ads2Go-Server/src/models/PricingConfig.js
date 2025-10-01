const mongoose = require('mongoose');

const pricingConfigSchema = new mongoose.Schema({
  // Field combinations for pricing
  materialType: {
    type: String,
    required: true,
    enum: ['LCD', 'HEADDRESS']
  },
  vehicleType: {
    type: String,
    required: true,
    enum: ['CAR', 'MOTORCYCLE']
  },
  category: {
    type: String,
    required: true,
    enum: ['DIGITAL', 'NON-DIGITAL']
  },
  
  // Pricing tiers based on duration
  pricingTiers: [{
    durationDays: {
      type: Number,
      required: true,
      min: 1
    },
    pricePerPlay: {
      type: Number,
      required: true,
      min: 0.01
    },
    // Optional: Different pricing for different ad lengths
    adLengthMultiplier: {
      type: Number,
      default: 1.0,
      min: 0.1,
      max: 2.0
    }
  }],
  
  // Device limits for this combination
  maxDevices: {
    type: Number,
    required: true,
    min: 1,
    max: 10
  },
  
  // Ad length limits
  minAdLengthSeconds: {
    type: Number,
    default: 5,
    min: 1
  },
  maxAdLengthSeconds: {
    type: Number,
    default: 60,
    min: 1
  },
  
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Metadata
  createdBy: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for efficient lookups
pricingConfigSchema.index({ materialType: 1, vehicleType: 1, category: 1, isActive: 1 });

// Method to get price for specific duration
pricingConfigSchema.methods.getPriceForDuration = function(durationDays) {
  // Sort pricing tiers by duration (ascending)
  const sortedTiers = this.pricingTiers.sort((a, b) => a.durationDays - b.durationDays);
  
  // Find the appropriate tier
  let selectedTier = sortedTiers[0]; // Default to first tier
  
  for (const tier of sortedTiers) {
    if (durationDays >= tier.durationDays) {
      selectedTier = tier;
    } else {
      break;
    }
  }
  
  return selectedTier.pricePerPlay;
};

// Method to get price with ad length multiplier
pricingConfigSchema.methods.getPriceWithAdLength = function(durationDays, adLengthSeconds) {
  const basePrice = this.getPriceForDuration(durationDays);
  const tier = this.pricingTiers.find(t => t.durationDays <= durationDays) || this.pricingTiers[0];
  return basePrice * (tier.adLengthMultiplier || 1.0);
};

// Static method to find pricing config
pricingConfigSchema.statics.findPricingConfig = function(materialType, vehicleType, category) {
  return this.findOne({
    materialType: materialType.toUpperCase(),
    vehicleType: vehicleType.toUpperCase(),
    category: category.toUpperCase(),
    isActive: true
  });
};

module.exports = mongoose.model('PricingConfig', pricingConfigSchema);

