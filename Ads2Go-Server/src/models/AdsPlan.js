const mongoose = require('mongoose');

const AdsPlanSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '', trim: true },

  // What is being advertised
  category: { type: String, enum: ['DIGITAL', 'NON_DIGITAL'], required: true, default: 'DIGITAL' },
  materialType: { type: String, enum: ['POSTER', 'LCD', 'STICKER', 'HEADDRESS', 'BANNER'], required: true, default: 'HEADDRESS' },
  vehicleType: { type: String, enum: ['CAR', 'MOTORCYCLE', 'BUS', 'JEEP', 'E_TRIKE'], required: true, default: 'CAR' },

  // Durations and pricing
  durationDays: { type: Number, required: true, default: 31 },
  adLengthSeconds: { type: Number, required: true, default: 20 },
  playsPerDayPerDevice: { type: Number, required: true, default: 100 },
  numberOfDevices: { type: Number, required: true, default: 1 },
  pricePerPlay: { type: Number, required: true, default: 1 },
  totalPrice: { type: Number, required: true, default: 0 },

  // Materials attached to the plan (optional)
  materials: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Material' }],

  isActive: { type: Boolean, default: true },
  
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
}, { timestamps: true });

// Indexes for archive functionality
AdsPlanSchema.index({ isArchived: 1 }); // Archive filter for queries
AdsPlanSchema.index({ scheduledDeletionDate: 1 }); // For deletion cron job

module.exports = mongoose.model('AdsPlan', AdsPlanSchema);
