const mongoose = require('mongoose');

const AdSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  riderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Rider',
    default: null
  },
  materialsId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Material',
    default: null
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  vehicleType: {
    type: String,
    required: true
  },
  materialsUsed: {
    type: String,
    required: true
  },
  adFormat: {
    type: String,
    required: true
  },
  mediaFile: {
    type: String,
    required: true
  },
  plan: {
    type: String,
    enum: ['Monthly', 'Weekly'],
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'RUNNING', 'ENDED'],
    default: 'PENDING',
    required: true
  },
  startTime: {
    type: Date,
    required: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Ad', AdSchema);
