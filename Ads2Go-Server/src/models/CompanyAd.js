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
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index for efficient querying
CompanyAdSchema.index({ isActive: 1, priority: -1 });
CompanyAdSchema.index({ createdAt: -1 });

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

// Static method to get random company ad
CompanyAdSchema.statics.getRandomAd = function() {
  return this.aggregate([
    { $match: { isActive: true } },
    { $sample: { size: 1 } },
    {
      $lookup: {
        from: 'users',
        localField: 'createdBy',
        foreignField: '_id',
        as: 'createdBy'
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: 'updatedBy',
        foreignField: '_id',
        as: 'updatedBy'
      }
    }
  ]).then(ads => {
    // Handle ads with null createdBy by providing a default user object
    return ads.map(ad => {
      if (!ad.createdBy || ad.createdBy.length === 0) {
        ad.createdBy = [{
          id: 'unknown',
          firstName: 'Unknown',
          lastName: 'User',
          email: 'unknown@example.com'
        }];
      }
      return ad;
    });
  });
};

module.exports = mongoose.model('CompanyAd', CompanyAdSchema);
