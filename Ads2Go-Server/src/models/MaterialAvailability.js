const mongoose = require('mongoose');

const MaterialAvailabilitySchema = new mongoose.Schema({
  materialId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Material',
    required: true,
    unique: true,
    index: true
  },
  
  // Capacity management
  totalSlots: {
    type: Number,
    default: 5,
    min: 1,
    max: 10
  },
  
  occupiedSlots: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Calculated field
  availableSlots: {
    type: Number,
    default: 5,
    min: 0
  },
  
  // Next available date for new ads
  nextAvailableDate: {
    type: Date,
    default: null
  },
  
  // When all slots will be free
  allSlotsFreeDate: {
    type: Date,
    default: null
  },
  
  // Current ads occupying slots
  currentAds: [{
    adId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ad',
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
    slotNumber: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    }
  }],
  
  // Queue for pending ads
  pendingAds: [{
    adId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ad',
      required: true
    },
    requestedStartTime: {
      type: Date,
      required: true
    },
    priority: {
      type: Number,
      default: 0,
      min: 0,
      max: 10
    },
    queuedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Status
  status: {
    type: String,
    enum: ['AVAILABLE', 'FULL', 'MAINTENANCE'],
    default: 'AVAILABLE'
  },
  
  // Last updated
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Pre-save hook to calculate available slots
MaterialAvailabilitySchema.pre('save', function(next) {
  this.availableSlots = this.totalSlots - this.occupiedSlots;
  this.lastUpdated = new Date();
  next();
});

// Method to check if material can accept new ad
MaterialAvailabilitySchema.methods.canAcceptAd = function(startTime, endTime) {
  if (this.status !== 'AVAILABLE') return false;
  if (this.availableSlots <= 0) return false;
  
  // Check for time conflicts
  const hasConflict = this.currentAds.some(ad => {
    return (startTime < ad.endTime && endTime > ad.startTime);
  });
  
  return !hasConflict;
};

// Method to add ad to material
MaterialAvailabilitySchema.methods.addAd = function(adId, startTime, endTime) {
  if (!this.canAcceptAd(startTime, endTime)) {
    throw new Error('Cannot add ad: no available slots or time conflict');
  }
  
  // Find next available slot number
  const usedSlots = this.currentAds.map(ad => ad.slotNumber);
  let slotNumber = 1;
  while (usedSlots.includes(slotNumber)) {
    slotNumber++;
  }
  
  this.currentAds.push({
    adId,
    startTime,
    endTime,
    slotNumber
  });
  
  this.occupiedSlots = this.currentAds.length;
  this.availableSlots = this.totalSlots - this.occupiedSlots;
  
  // Update next available date
  this.updateAvailabilityDates();
};

// Method to remove ad from material
MaterialAvailabilitySchema.methods.removeAd = function(adId) {
  this.currentAds = this.currentAds.filter(ad => ad.adId.toString() !== adId.toString());
  this.occupiedSlots = this.currentAds.length;
  this.availableSlots = this.totalSlots - this.occupiedSlots;
  
  // Update next available date
  this.updateAvailabilityDates();
};

// Method to update availability dates
MaterialAvailabilitySchema.methods.updateAvailabilityDates = function() {
  if (this.currentAds.length === 0) {
    this.nextAvailableDate = new Date();
    this.allSlotsFreeDate = new Date();
    return;
  }
  
  // Find the earliest end time for next available slot
  const endTimes = this.currentAds.map(ad => ad.endTime).sort();
  this.nextAvailableDate = endTimes[0];
  
  // Find the latest end time for when all slots are free
  this.allSlotsFreeDate = endTimes[endTimes.length - 1];
};

// Static method to get availability for multiple materials
MaterialAvailabilitySchema.statics.getMaterialsAvailability = async function(materialIds) {
  const availabilities = await this.find({ materialId: { $in: materialIds } })
    .populate('materialId', 'materialId materialType vehicleType category');
  
  return availabilities.map(avail => ({
    materialId: avail.materialId._id,
    materialInfo: avail.materialId,
    totalSlots: avail.totalSlots,
    occupiedSlots: avail.occupiedSlots,
    availableSlots: avail.availableSlots,
    nextAvailableDate: avail.nextAvailableDate,
    allSlotsFreeDate: avail.allSlotsFreeDate,
    status: avail.status,
    canAcceptAd: avail.availableSlots > 0 && avail.status === 'AVAILABLE'
  }));
};

module.exports = mongoose.model('MaterialAvailability', MaterialAvailabilitySchema);
