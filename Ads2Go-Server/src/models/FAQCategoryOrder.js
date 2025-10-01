const mongoose = require('mongoose');

const faqCategoryOrderSchema = new mongoose.Schema({
  category: {
    type: String,
    required: true,
    enum: ['ADVERTISERS', 'DRIVERS', 'EVERYONE'],
    unique: true
  },
  order: {
    type: Number,
    required: true,
    default: 0
  }
}, {
  timestamps: true
});

// Index for efficient queries
faqCategoryOrderSchema.index({ order: 1 });

// Static method to get category order
faqCategoryOrderSchema.statics.getCategoryOrder = async function() {
  const categoryOrders = await this.find().sort({ order: 1 });
  
  // If no category orders exist, create default ones
  if (categoryOrders.length === 0) {
    const defaultOrders = [
      { category: 'EVERYONE', order: 1 },
      { category: 'ADVERTISERS', order: 2 },
      { category: 'DRIVERS', order: 3 }
    ];
    
    await this.insertMany(defaultOrders);
    return defaultOrders;
  }
  
  return categoryOrders;
};

// Static method to update category order
faqCategoryOrderSchema.statics.updateCategoryOrder = async function(categoryOrders) {
  const operations = categoryOrders.map(({ category, order }) => ({
    updateOne: {
      filter: { category },
      update: { order },
      upsert: true
    }
  }));
  
  await this.bulkWrite(operations);
};

module.exports = mongoose.model('FAQCategoryOrder', faqCategoryOrderSchema);
