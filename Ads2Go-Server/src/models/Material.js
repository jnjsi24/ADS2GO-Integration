const mongoose = require('mongoose');

const MaterialSchema = new mongoose.Schema({
  vehicleType: {
    type: String,
    enum: ['CAR', 'MOTORCYCLE', 'BUS', 'JEEP', 'E_TRIKE'],
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
  materialName: {
    type: String,
    trim: true,
    default: function() {
      return `${this.materialType} for ${this.vehicleType}`;
    }
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'INACTIVE', 'MAINTENANCE', 'RETIRED'],
    default: 'ACTIVE'
  },
  assignedDate: {
    type: Date,
    default: null
  },
  location: {
    address: String,
    coordinates: {
      type: [Number],
      index: '2dsphere'
    }
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
    try {
      const prefix = this.category === 'DIGITAL' ? 'DGL' : 'NDGL';
      const baseId = `${prefix}-${this.materialType}-${this.vehicleType}`;
      
      // Find all existing material IDs with the same base
      const existingMaterials = await this.constructor.find({
        materialType: this.materialType,
        vehicleType: this.vehicleType,
        category: this.category
      }, 'materialId');
      
      // Extract the numeric parts and find the highest number
      const numbers = existingMaterials.map(material => {
        const match = material.materialId.match(/-([0-9]+)$/);
        return match ? parseInt(match[1], 10) : 0;
      });
      
      // Find the next available number
      let nextNumber = 1;
      while (numbers.includes(nextNumber)) {
        nextNumber++;
      }
      
      // Generate the new ID with 3-digit padding
      this.materialId = `${baseId}-${String(nextNumber).padStart(3, '0')}`;
      console.log(`🔧 Generated materialId: ${this.materialId} for ${this.materialType} ${this.vehicleType}`);
    } catch (error) {
      console.error(`❌ Error in pre-save hook:`, error);
      throw error;
    }
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
  this.assignedDate = new Date();
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

module.exports = mongoose.models.Material || mongoose.model('Material', MaterialSchema);
