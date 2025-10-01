const mongoose = require('mongoose');

const faqSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  answer: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
  },
  category: {
    type: String,
    required: true,
    enum: ['ADVERTISERS', 'DRIVERS', 'EVERYONE'],
    index: true
  },
  order: {
    type: Number,
    default: 0,
    index: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  }
}, {
  timestamps: true
});

// Index for efficient queries
faqSchema.index({ category: 1, isActive: 1, order: 1 });

// Virtual for formatted timestamps
faqSchema.virtual('createdAtFormatted').get(function() {
  return this.createdAt.toISOString();
});

faqSchema.virtual('updatedAtFormatted').get(function() {
  return this.updatedAt.toISOString();
});

// Ensure virtual fields are serialized and id field is properly mapped
faqSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

// Static method to get FAQs with filters
faqSchema.statics.getFAQs = async function(filters = {}) {
  try {
    const query = {};
    
    if (filters.category) {
      query.category = filters.category;
    }
    
    if (filters.isActive !== undefined) {
      query.isActive = filters.isActive;
    }

    const faqs = await this.find(query)
      .sort({ order: 1, createdAt: -1 });

    return {
      success: true,
      message: 'FAQs retrieved successfully',
      faqs,
      totalCount: faqs.length
    };
  } catch (error) {
    console.error('Error getting FAQs:', error);
    return {
      success: false,
      message: 'Failed to retrieve FAQs',
      faqs: [],
      totalCount: 0
    };
  }
};

// Static method to reorder FAQs
faqSchema.statics.reorderFAQs = async function(faqIds) {
  try {
    const updatePromises = faqIds.map((faqId, index) => 
      this.findByIdAndUpdate(faqId, { order: index + 1 }, { new: true })
    );
    
    await Promise.all(updatePromises);
    
    return {
      success: true,
      message: 'FAQs reordered successfully'
    };
  } catch (error) {
    console.error('Error reordering FAQs:', error);
    return {
      success: false,
      message: 'Failed to reorder FAQs'
    };
  }
};

module.exports = mongoose.model('FAQ', faqSchema);
