const mongoose = require('mongoose');

const CompanyAdSchema = new mongoose.Schema({
  // Basic ad information
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  
  // Media information
  mediaFile: {
    type: String,
    required: true
  },
  adFormat: {
    type: String,
    enum: ['VIDEO', 'IMAGE'],
    required: true
  },
  duration: {
    type: Number, // in seconds
    required: true,
    min: 1,
    max: 300 // 5 minutes max
  },
  
  // Display settings
  isActive: {
    type: Boolean,
    default: true
  },
  priority: {
    type: Number,
    default: 0,
    min: 0,
    max: 10 // Higher number = higher priority
  },
  
  // Scheduling settings
  isScheduled: {
    type: Boolean,
    default: false
  },
  startDate: {
    type: Date,
    default: null
  },
  endDate: {
    type: Date,
    default: null
  },
  scheduleType: {
    type: String,
    enum: ['IMMEDIATE', 'SCHEDULED'],
    default: 'IMMEDIATE'
  },
  
  // Usage tracking
  playCount: {
    type: Number,
    default: 0
  },
  lastPlayed: {
    type: Date,
    default: null
  },
  
  // Admin information
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  
  // Metadata
  tags: [{
    type: String,
    trim: true
  }],
  notes: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  
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
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index for efficient querying
CompanyAdSchema.index({ isActive: 1, priority: -1 });
CompanyAdSchema.index({ createdAt: -1 });
CompanyAdSchema.index({ isScheduled: 1, startDate: 1, endDate: 1 });
CompanyAdSchema.index({ isArchived: 1 }); // Archive filter for queries
CompanyAdSchema.index({ scheduledDeletionDate: 1 }); // For deletion cron job

// Virtual for file size (if needed)
CompanyAdSchema.virtual('fileSize').get(function() {
  // This would need to be calculated when uploading
  return this._fileSize || 0;
});

// Pre-save middleware
CompanyAdSchema.pre('save', function(next) {
  // Auto-set adFormat based on mediaFile extension
  if (this.mediaFile) {
    const extension = this.mediaFile.split('.').pop().toLowerCase();
    if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(extension)) {
      this.adFormat = 'VIDEO';
    } else if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension)) {
      this.adFormat = 'IMAGE';
    }
  }
  next();
});

// Static method to get active company ads
CompanyAdSchema.statics.getActiveAds = function() {
  return this.find({ isActive: true })
    .sort({ priority: -1, createdAt: -1 })
    .populate('createdBy', 'firstName lastName email')
    .populate('updatedBy', 'firstName lastName email')
    .then(ads => {
      // Handle ads with null createdBy by providing a default user object
      return ads.map(ad => {
        if (!ad.createdBy) {
          ad.createdBy = {
            id: 'unknown',
            firstName: 'Unknown',
            lastName: 'User',
            email: 'unknown@example.com'
          };
        }
        return ad;
      });
    });
};

// Static method to get random company ad with priority weighting
CompanyAdSchema.statics.getRandomAd = function() {
  return this.find({ isActive: true })
    .populate('createdBy', 'firstName lastName email')
    .populate('updatedBy', 'firstName lastName email')
    .then(ads => {
      if (ads.length === 0) return null;
      
      // Handle ads with null createdBy by providing a default user object
      const processedAds = ads.map(ad => {
        if (!ad.createdBy) {
          ad.createdBy = {
            id: 'unknown',
            firstName: 'Unknown',
            lastName: 'User',
            email: 'unknown@example.com'
          };
        }
        return ad;
      });
      
      // Weighted random selection based on priority
      const weights = processedAds.map(ad => Math.max(1, ad.priority)); // Min weight of 1
      const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
      
      let random = Math.random() * totalWeight;
      
      for (let i = 0; i < processedAds.length; i++) {
        random -= weights[i];
        if (random <= 0) {
          console.log(`🎯 Selected ad "${processedAds[i].title}" with priority ${processedAds[i].priority} (weight: ${weights[i]})`);
          return processedAds[i];
        }
      }
      
      // Fallback to last ad
      return processedAds[processedAds.length - 1];
    });
};

// Instance method to check if ad should be active based on scheduling
CompanyAdSchema.methods.shouldBeActive = function() {
  const now = new Date();
  
  // If not scheduled, use the isActive field
  if (!this.isScheduled || this.scheduleType === 'IMMEDIATE') {
    return this.isActive;
  }
  
  // For scheduled ads, check date ranges
  if (this.scheduleType === 'SCHEDULED') {
    const startDate = this.startDate ? new Date(this.startDate) : null;
    const endDate = this.endDate ? new Date(this.endDate) : null;
    
    // If no dates set, use isActive
    if (!startDate && !endDate) {
      return this.isActive;
    }
    
    // Check if current time is within the scheduled range
    const isAfterStart = !startDate || now >= startDate;
    const isBeforeEnd = !endDate || now <= endDate;
    
    return isAfterStart && isBeforeEnd;
  }
  
  
  return this.isActive;
};

// Static method to get currently active ads (considering scheduling)
CompanyAdSchema.statics.getCurrentlyActiveAds = function() {
  return this.find({ isActive: true })
    .populate('createdBy', 'firstName lastName email')
    .populate('updatedBy', 'firstName lastName email')
    .then(ads => {
      const now = new Date();
      
      return ads.filter(ad => {
        // If not scheduled, use isActive
        if (!ad.isScheduled || ad.scheduleType === 'IMMEDIATE') {
          return ad.isActive;
        }
        
        // For scheduled ads, check date ranges
        if (ad.scheduleType === 'SCHEDULED') {
          const startDate = ad.startDate ? new Date(ad.startDate) : null;
          const endDate = ad.endDate ? new Date(ad.endDate) : null;
          
          if (!startDate && !endDate) {
            return ad.isActive;
          }
          
          const isAfterStart = !startDate || now >= startDate;
          const isBeforeEnd = !endDate || now <= endDate;
          
          return isAfterStart && isBeforeEnd;
        }
        
        
        return ad.isActive;
      }).map(ad => {
        // Handle ads with null createdBy by providing a default user object
        if (!ad.createdBy) {
          ad.createdBy = {
            id: 'unknown',
            firstName: 'Unknown',
            lastName: 'User',
            email: 'unknown@example.com'
          };
        }
        return ad;
      });
    });
};

// Static method to get random ad considering scheduling
CompanyAdSchema.statics.getRandomScheduledAd = function() {
  return this.getCurrentlyActiveAds()
    .then(ads => {
      if (ads.length === 0) return null;
      
      // Weighted random selection based on priority
      const weights = ads.map(ad => Math.max(1, ad.priority)); // Min weight of 1
      const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
      
      let random = Math.random() * totalWeight;
      
      for (let i = 0; i < ads.length; i++) {
        random -= weights[i];
        if (random <= 0) {
          console.log(`🎯 Selected scheduled ad "${ads[i].title}" with priority ${ads[i].priority} (weight: ${weights[i]})`);
          return ads[i];
        }
      }
      
      // Fallback to last ad
      return ads[ads.length - 1];
    });
};

module.exports = mongoose.model('CompanyAd', CompanyAdSchema);
