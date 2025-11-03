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
  
  // Base Price for 20-second ad / 1 month / 1 vehicle
  basePrice: {
    type: Number,
    required: true,
    min: 0.01
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

// Method to calculate total price using new formula
// Total Price = Base Price × Ad Length Multiplier × Duration (months) × Number of Vehicles × Duration Discount Multiplier
pricingConfigSchema.methods.calculateTotalPrice = async function(adLengthSeconds, durationMonths, numberOfVehicles) {
  const GlobalPricingMultipliers = mongoose.model('GlobalPricingMultipliers');
  const multipliers = await GlobalPricingMultipliers.getMultipliers();
  
  // Hardcoded ad length multipliers (based on screen time)
  // 20s = 1.0x (base), 40s = 2.0x (double), 60s = 3.0x (triple)
  const adLengthMultiplierMap = {
    20: 1.0,
    40: 2.0,
    60: 3.0
  };
  const adLengthMultiplier = adLengthMultiplierMap[adLengthSeconds] || 1.0;
  
  // Get duration discount multiplier from database (uses numeric string keys)
  const durationDiscountMultiplier = multipliers.durationDiscountMultipliers[durationMonths.toString()] || 1.0;
  
  // Calculate total price
  const totalPrice = this.basePrice 
    * adLengthMultiplier 
    * durationMonths 
    * numberOfVehicles 
    * durationDiscountMultiplier;
  
  return {
    basePrice: this.basePrice,
    adLengthMultiplier,
    durationMonths,
    numberOfVehicles,
    durationDiscountMultiplier,
    totalPrice,
    subtotal: this.basePrice * adLengthMultiplier * durationMonths * numberOfVehicles,
    discount: (this.basePrice * adLengthMultiplier * durationMonths * numberOfVehicles) * (1 - durationDiscountMultiplier)
  };
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

