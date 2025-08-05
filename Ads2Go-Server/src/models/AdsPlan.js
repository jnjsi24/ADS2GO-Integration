const mongoose = require('mongoose');

const adsPlanSchema = new mongoose.Schema({
  name: { type: String, required: true },
  durationDays: { type: Number, required: true },
  category: { type: String, enum: ['digital', 'non-digital'], required: true },
  materialType: { type: String, required: true },
  vehicleType: { type: String, required: true },
  price: { type: Number, required: true },
  description: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('AdsPlan', adsPlanSchema);