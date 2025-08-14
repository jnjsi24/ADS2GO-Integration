const mongoose = require('mongoose');

const adsPlanSchema = new mongoose.Schema({
  name: { type: String, required: true }, // Plan name (e.g., "City Dominator")
  
  durationDays: { type: Number, required: true }, // Plan length in days
  
  category: { type: String, enum: ['digital', 'non-digital'], required: true }, // Ad category
  
  materialType: { type: String, required: true }, // e.g., Video, Image, Static Banner, LCD
  
  vehicleType: { type: String, required: true }, // Device placement, type of display (e.g., car, bus)
  
  numberOfDevices: { type: Number, required: true }, // How many devices will display this ad
  
  adLengthMinutes: { type: Number, required: true }, // Length of ad in minutes
  
  playsPerDayPerDevice: { type: Number, required: true }, // e.g., 720 for 12 hours of 1-min slots
  
  totalPlaysPerDay: { type: Number, required: true }, // Auto-calculated: playsPerDayPerDevice * numberOfDevices
  
  pricePerPlay: { type: Number, required: true }, // Price per ad play per device
  
  dailyRevenue: { type: Number, required: true }, // Auto-calculated: pricePerPlay * totalPlaysPerDay
  
  totalPrice: { type: Number, required: true }, // Total package price for the plan
  
  description: { type: String, required: true }, // Plan description to show differences between plans

  // Tracking fields
  impressions: { type: Number, default: 0 }, // Number of times the ad has been shown
  status: { type: String, enum: ['PENDING', 'RUNNING', 'ENDED'], default: 'PENDING' }, // Current status
  startDate: { type: Date }, // When the ad started running
  endDate: { type: Date }, // When the ad ended
  
}, { timestamps: true });

// Virtual field: Calculate how long the ad has been running (in days)
adsPlanSchema.virtual('currentDurationDays').get(function () {
  if (!this.startDate) return 0;
  const end = this.endDate || new Date();
  const diffTime = Math.abs(end - this.startDate);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

module.exports = mongoose.model('AdsPlan', adsPlanSchema);
