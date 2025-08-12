const mongoose = require('mongoose');

const MaterialSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Material name is required'],
    trim: true,
    minlength: [3, 'Name must be at least 3 characters long']
  },
  description: {
    type: String,
    trim: true
  },
  requirements: {
    type: String,
    trim: true
  },
  category: {
    type: String,
    enum: ['DIGITAL', 'NON_DIGITAL'],
    required: [true, 'Category is required']
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price must be a non-negative number']
  },
  materialType: {
    type: String,
    required: [true, 'Material type is required'],
    trim: true,
  },
  vehicleType: {
    type: String,
    required: [true, 'Vehicle type is required'],
    trim: true,
  }
}, { timestamps: true });

module.exports = mongoose.model('Material', MaterialSchema);
