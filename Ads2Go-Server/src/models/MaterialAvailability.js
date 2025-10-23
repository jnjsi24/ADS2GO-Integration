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
  
  // Current ads occupying slots (ads that are currently running)
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
  
  // ✅ NEW: Scheduled/future ads with reserved slots
  scheduledAds: [{
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
    },
    reservedAt: {
      type: Date,
      default: Date.now
    },
    reservationExpires: {
      type: Date,
      default: null
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
  if (this.totalSlots <= 0) return false;
  
  // ✅ NEW: Check for time period conflicts with both current and scheduled ads
  const requestStart = new Date(startTime);
  const requestEnd = new Date(endTime);
  
  // Find all ads that overlap with the requested time period
  const overlappingAds = [
    ...this.currentAds,
    ...this.scheduledAds
  ].filter(ad => {
    const adStart = new Date(ad.startTime);
    const adEnd = new Date(ad.endTime);
    
    // Check if time periods overlap
    // Overlap occurs if: (StartA < EndB) AND (EndA > StartB)
    return (requestStart < adEnd && requestEnd > adStart);
  });
  
  // Count how many slots are occupied during the requested time period
  const slotsOccupiedDuringPeriod = overlappingAds.length;
  
  // Check if there's at least one free slot during the requested period
  const hasAvailableSlot = slotsOccupiedDuringPeriod < this.totalSlots;
  
  // Log for debugging
  if (!hasAvailableSlot) {
    console.log(`⚠️  Material has no available slots during ${requestStart.toISOString()} - ${requestEnd.toISOString()}`);
    console.log(`   Total slots: ${this.totalSlots}, Occupied: ${slotsOccupiedDuringPeriod}`);
  }
  
  return hasAvailableSlot;
};

// Method to add ad to material (for currently running ads)
MaterialAvailabilitySchema.methods.addAd = function(adId, startTime, endTime) {
  if (!this.canAcceptAd(startTime, endTime)) {
    throw new Error('Cannot add ad: no available slots or time conflict');
  }
  
  // Find next available slot number
  const usedSlots = this.currentAds.map(ad => ad.slotNumber);
  let slotNumber = 1;
  while (usedSlots.includes(slotNumber) && slotNumber <= this.totalSlots) {
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

// ✅ NEW: Method to reserve slot for scheduled/future ad
MaterialAvailabilitySchema.methods.reserveSlot = function(adId, startTime, endTime, reservationExpires = null) {
  if (!this.canAcceptAd(startTime, endTime)) {
    throw new Error('Cannot reserve slot: no available slots or time conflict during requested period');
  }
  
  // Find next available slot number during the requested time period
  const requestStart = new Date(startTime);
  const requestEnd = new Date(endTime);
  
  // Get all slots that will be in use during this period
  const usedSlotsDuringPeriod = [
    ...this.currentAds,
    ...this.scheduledAds
  ]
    .filter(ad => {
      const adStart = new Date(ad.startTime);
      const adEnd = new Date(ad.endTime);
      return (requestStart < adEnd && requestEnd > adStart);
    })
    .map(ad => ad.slotNumber);
  
  // Find first available slot number
  let slotNumber = 1;
  while (usedSlotsDuringPeriod.includes(slotNumber) && slotNumber <= this.totalSlots) {
    slotNumber++;
  }
  
  if (slotNumber > this.totalSlots) {
    throw new Error('No available slot number found');
  }
  
  // Add to scheduledAds
  this.scheduledAds.push({
    adId,
    startTime,
    endTime,
    slotNumber,
    reservedAt: new Date(),
    reservationExpires
  });
  
  console.log(`✅ Reserved slot ${slotNumber} for ad ${adId} during ${startTime} - ${endTime}`);
  
  // Update availability dates
  this.updateAvailabilityDates();
  
  return slotNumber;
};

// Method to remove ad from material
MaterialAvailabilitySchema.methods.removeAd = function(adId) {
  this.currentAds = this.currentAds.filter(ad => ad.adId.toString() !== adId.toString());
  this.scheduledAds = this.scheduledAds.filter(ad => ad.adId.toString() !== adId.toString());
  this.occupiedSlots = this.currentAds.length;
  this.availableSlots = this.totalSlots - this.occupiedSlots;
  
  // Update next available date
  this.updateAvailabilityDates();
};

// ✅ NEW: Method to release expired slot reservations
MaterialAvailabilitySchema.methods.releaseExpiredReservations = function() {
  const now = new Date();
  const expiredCount = this.scheduledAds.filter(ad => 
    ad.reservationExpires && ad.reservationExpires < now
  ).length;
  
  if (expiredCount > 0) {
    this.scheduledAds = this.scheduledAds.filter(ad => 
      !ad.reservationExpires || ad.reservationExpires >= now
    );
    
    console.log(`🧹 Released ${expiredCount} expired reservation(s) for material`);
    this.updateAvailabilityDates();
  }
  
  return expiredCount;
};

// ✅ NEW: Method to move scheduled ad to current ads when start time arrives
MaterialAvailabilitySchema.methods.activateScheduledAds = function() {
  const now = new Date();
  const adsToActivate = this.scheduledAds.filter(ad => new Date(ad.startTime) <= now);
  
  if (adsToActivate.length > 0) {
    // Move from scheduledAds to currentAds
    for (const ad of adsToActivate) {
      this.currentAds.push({
        adId: ad.adId,
        startTime: ad.startTime,
        endTime: ad.endTime,
        slotNumber: ad.slotNumber
      });
    }
    
    // Remove from scheduledAds
    this.scheduledAds = this.scheduledAds.filter(ad => new Date(ad.startTime) > now);
    
    // Update counts
    this.occupiedSlots = this.currentAds.length;
    this.availableSlots = this.totalSlots - this.occupiedSlots;
    this.updateAvailabilityDates();
    
    console.log(`✅ Activated ${adsToActivate.length} scheduled ad(s) to current ads`);
  }
  
  return adsToActivate.map(ad => ad.adId);
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
