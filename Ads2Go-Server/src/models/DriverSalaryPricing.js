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

  // 24-hour delay: old rate used for salary computation until this time (then new rate applies)
  previousDistanceRate: { type: Number, default: null },
  previousHoursRate: { type: Number, default: null },
  previousRateEffectiveUntil: { type: Date, default: null },
  
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
  },
  
  // Soft delete / Archive fields (30-day deferred deletion)
  isArchived: {
    type: Boolean,
    default: false
  },
  archivedAt: {
    type: Date,
    default: null
  },
  scheduledDeletionDate: {
    type: Date,
    default: null
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
DriverSalaryPricingSchema.index({ isArchived: 1 }); // Archive filter for queries
DriverSalaryPricingSchema.index({ scheduledDeletionDate: 1 }); // For deletion cron job

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
