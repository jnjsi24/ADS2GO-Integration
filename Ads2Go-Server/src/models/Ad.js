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
  materialId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Material',
    required: true
  },
  planId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AdsPlan', // Ensure this matches your Plan model name
    required: true
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
  adType: {
    type: String,
    enum: ['DIGITAL', 'NON_DIGITAL'],
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
  },
  endTime: {
    type: Date,
    required: true
  },
  reasonForReject: {
    type: String,
    default: null
  },
  approveTime: {
    type: Date,
    default: null
  },
  rejectTime: {
    type: Date,
    default: null
  }
}, { timestamps: true });

module.exports = mongoose.model('Ad', AdSchema);
