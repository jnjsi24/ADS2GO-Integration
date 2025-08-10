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

module.exports = mongoose.model('Material', MaterialSchema);
