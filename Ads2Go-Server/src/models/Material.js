const mongoose = require('mongoose');

const MaterialSchema = new mongoose.Schema({
  vehicleType: {
    type: String,
    enum: ['CAR', 'MOTOR', 'BUS', 'JEEP', 'E_TRIKE'],
    required: [true, 'Vehicle type is required'],
  },
  materialType: {
    type: String,
    enum: ['POSTER', 'LCD', 'STICKER', 'LCD_HEADDRESS', 'BANNER'],
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
    unique: true,
    index: true,
  },
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver',
    default: null, // assigned on approval
  },
  mountedAt: {
    type: Date,
    default: null,
  },
  dismountedAt: {
    type: Date,
    default: null,
  },
}, { timestamps: true });

// Pre-save hook to auto-generate materialId
MaterialSchema.pre('save', async function () {
  if (
    this.isModified('category') || 
    this.isModified('materialType') || 
    this.isModified('vehicleType') || 
    !this.materialId
  ) {
    const categoryAbbrev = this.category === 'DIGITAL' ? 'DGL' : 'NDGL';
    const baseId = `${categoryAbbrev}_${this.materialType}_${this.vehicleType}`;

    // Count how many materials already have a similar ID
    const count = await this.constructor.countDocuments({
      materialId: new RegExp(`^${baseId}`),
      _id: { $ne: this._id }, // exclude current doc if updating
    });

    // Assign materialId with increment if needed
    this.materialId = count === 0 ? baseId : `${baseId}_${count + 1}`;
  }
});

module.exports = mongoose.model('Material', MaterialSchema);