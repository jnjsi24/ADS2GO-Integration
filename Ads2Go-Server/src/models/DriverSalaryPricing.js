const mongoose = require('mongoose');

const DriverSalaryPricingSchema = new mongoose.Schema({
  // Pricing configuration identifier
  vehicleType: {
    type: String,
    enum: ['CAR', 'MOTORCYCLE', 'BUS', 'JEEP', 'E_TRIKE'],
    required: [true, 'Vehicle type is required']
  },
  category: {
    type: String,
    enum: ['DIGITAL', 'NON_DIGITAL'],
    required: [true, 'Category is required']
  },
  materialType: {
    type: String,
    enum: ['LCD', 'BANNER', 'STICKER', 'HEADDRESS', 'POSTER'],
    required: [true, 'Material type is required']
  },
  
  // Pricing rates (per unit)
  distanceRate: {
    type: Number,
    required: [true, 'Distance rate is required'],
    min: [0, 'Distance rate must be non-negative']
  },
  hoursRate: {
    type: Number,
    required: [true, 'Hours rate is required'],
    min: [0, 'Hours rate must be non-negative']
  },
  
  // Metadata
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SuperAdmin',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SuperAdmin'
  },
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Ensure unique combination of vehicleType, category, and materialType
DriverSalaryPricingSchema.index(
  { vehicleType: 1, category: 1, materialType: 1 }, 
  { unique: true }
);

// Virtual for display name
DriverSalaryPricingSchema.virtual('displayName').get(function() {
  return `${this.materialType} (${this.category}) for ${this.vehicleType}`;
});

// Pre-save hook to update updatedBy
DriverSalaryPricingSchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    this.updatedAt = new Date();
  }
  next();
});

module.exports = mongoose.model('DriverSalaryPricing', DriverSalaryPricingSchema);
