const mongoose = require('mongoose');

const toUpper = v => (typeof v === 'string' ? v.toUpperCase() : v);

const adsPlanSchema = new mongoose.Schema({
  name: { type: String, required: true }, // Plan name (e.g., "City Dominator")
  
  durationDays: { type: Number, required: true }, // Plan length in days
  
  category: { 
    type: String, 
    enum: ['DIGITAL', 'NON-DIGITAL'], 
    required: true, 
    set: toUpper   // auto-uppercase input
  }, 
  
  materialType: { 
    type: String, 
    required: true, 
    set: toUpper   // e.g. "lcd" -> "LCD"
  }, 
  
  vehicleType: { 
    type: String, 
    required: true, 
    set: toUpper   // e.g. "car" -> "CAR"
  }, 
  
  numberOfDevices: { type: Number, required: true }, 
  adLengthMinutes: { type: Number, required: true }, 
  playsPerDayPerDevice: { type: Number, required: true }, 
  
  totalPlaysPerDay: { type: Number, required: true }, 
  pricePerPlay: { type: Number, required: true }, 
  dailyRevenue: { type: Number, required: true }, 
  totalPrice: { type: Number, required: true }, 
  
  description: { type: String, required: true }, 

  // Status and scheduling
  status: { 
    type: String, 
    enum: ['PENDING', 'RUNNING', 'ENDED'], 
    default: 'PENDING',
    set: toUpper   // ensures status always uppercase
  }, 
  startDate: { type: Date }, 
  endDate: { type: Date }, 
  
}, { timestamps: true });

// Virtual field: Calculate how long the ad has been running (in days)
adsPlanSchema.virtual('currentDurationDays').get(function () {
  if (!this.startDate) return 0;
  const end = this.endDate || new Date();
  const diffTime = Math.abs(end - this.startDate);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

module.exports = mongoose.model('AdsPlan', adsPlanSchema);
