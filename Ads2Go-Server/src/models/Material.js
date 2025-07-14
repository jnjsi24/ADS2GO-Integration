const mongoose = require('mongoose');

const AdvertisementSubSchema = new mongoose.Schema({
  advertisementId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Advertisement',
    required: true
  },
  assignedAt: {
    type: Date,
    default: Date.now
  },
  removedAt: {
    type: Date
  }
}, { _id: false });

const MaterialSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, enum: ['digital', 'non-digital'], required: true },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  riderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Rider', required: true },
  advertisements: [AdvertisementSubSchema]
}, { timestamps: true });

module.exports = mongoose.model('Material', MaterialSchema);