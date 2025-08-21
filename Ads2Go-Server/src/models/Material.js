const mongoose = require('mongoose');

const MaterialSchema = new mongoose.Schema({
  vehicleType: {
    type: String,
    enum: ['CAR', 'MOTOR', 'BUS', 'JEEP', 'E_TRIKE'],
    required: [true, 'Vehicle type is required'],
  },
  materialType: {
    type: String,
    enum: ['POSTER', 'LCD', 'STICKER', 'HEADDRESS', 'BANNER'],
    required: [true, 'Material type is required'],
  },
  description: {
    type: String,
    trim: true,
  },
  requirements: {
    type: String,
    trim: true,
  },
  category: {
    type: String,
    enum: ['DIGITAL', 'NON_DIGITAL'],
    required: [true, 'Category is required'],
  },
  materialId: {
    type: String,
    index: true,
  },
  driverId: {
    type: String,   // DRV-001, not ObjectId
    default: null,
    index: true,
    sparse: true,
  },
  mountedAt: {
    type: Date,
    default: null,
  },
  dismountedAt: {
    type: Date,
    default: null,
  },
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Pre-save hook to generate sequential materialId
MaterialSchema.pre('save', async function() {
  if (this.isNew) {
    const prefix = this.category === 'DIGITAL' ? 'DGL' : 'NDGL';
    const baseId = `${prefix}-${this.materialType}-${this.vehicleType}`;
    
    // Find the count of existing materials with the same type and vehicle
    const count = await this.constructor.countDocuments({
      materialType: this.materialType,
      vehicleType: this.vehicleType,
      category: this.category
    });
    
    // Generate the new ID with 3-digit padding
    this.materialId = `${baseId}-${String(count + 1).padStart(3, '0')}`;
  }
});

// Virtual for driver details
MaterialSchema.virtual('driver', {
  ref: 'Driver',
  localField: 'driverId',
  foreignField: 'driverId',
  justOne: true,
  options: { select: 'driverId firstName lastName email contactNumber' }
});

// Method to assign to driver
MaterialSchema.methods.assignToDriver = async function(driverId) {
  if (this.driverId) {
    throw new Error('Material is already assigned to a driver');
  }
  
  this.driverId = driverId;
  this.mountedAt = new Date();
  await this.save();
  return this;
};

// Method to unassign from driver
MaterialSchema.methods.unassignFromDriver = async function() {
  if (!this.driverId) {
    throw new Error('Material is not assigned to any driver');
  }
  
  this.driverId = null;
  this.dismountedAt = new Date();
  await this.save();
  return this;
};

// Index to ensure one-to-one relationship between driver and material
MaterialSchema.index(
  { driverId: 1 },
  { 
    unique: true, 
    partialFilterExpression: { driverId: { $exists: true } },
    name: 'driverId_unique_when_set'
  }
);

module.exports = mongoose.model('Material', MaterialSchema);
