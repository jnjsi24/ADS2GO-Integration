const mongoose = require('mongoose');

const TabletUnitSchema = new mongoose.Schema({
  tabletNumber: { type: Number, required: true },
  deviceId: { type: String, default: null }, // Unique device identifier
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
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Material', 
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

module.exports = mongoose.model('Tablet', TabletSchema);
