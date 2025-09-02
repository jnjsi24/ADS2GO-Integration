const mongoose = require('mongoose');

const TabletUnitSchema = new mongoose.Schema({
  tabletNumber: { type: Number, required: true },
  deviceId: { type: String }, // Remove default: null to prevent unique index conflicts
  status: { 
    type: String, 
    enum: ['ONLINE', 'OFFLINE'], 
    default: 'OFFLINE' 
  },
  gps: {
    lat: { type: Number, default: null },
    lng: { type: Number, default: null }
  },
  lastSeen: { 
    type: Date, 
    default: null 
  }
}, { _id: false });

const TabletSchema = new mongoose.Schema({
  materialId: { 
    type: String, 
    required: true 
  },
  carGroupId: { 
    type: String, 
    required: true 
  },
  tablets: [TabletUnitSchema],
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
}, { timestamps: true });

// Ensure there are exactly 2 tablets in the array
TabletSchema.pre('save', function(next) {
  if (this.tablets.length !== 2) {
    throw new Error('Each Tablet document must contain exactly 2 tablets');
  }
  next();
});

// Create a sparse unique index for deviceId (only applies to non-null values)
TabletSchema.index({ 'tablets.deviceId': 1 }, { 
  unique: true, 
  sparse: true,
  name: 'tablets_deviceId_sparse_unique'
});

module.exports = mongoose.models.Tablet || mongoose.model('Tablet', TabletSchema);
