const mongoose = require('mongoose');

const DriverSalaryCalculationSchema = new mongoose.Schema({
  // Driver and material references
  driverId: {
    type: String, // System driverId (e.g., DRV-001)
    required: [true, 'Driver ID is required'],
    index: true
  },
  driverName: {
    type: String, // Driver's full name (e.g., "John Doe")
    required: [true, 'Driver name is required'],
    index: true
  },
  materialId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Material',
    required: [true, 'Material ID is required'],
    index: true
  },
  deviceId: {
    type: String, // Device ID from the material (e.g., "DGL-HEADDRESS-CAR-005")
    required: [true, 'Device ID is required'],
    index: true
  },
  
  // Calculation period
  calculationPeriod: {
    startDate: {
      type: Date,
      required: [true, 'Start date is required']
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required']
    },
    periodType: {
      type: String,
      enum: ['DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM'],
      default: 'MONTHLY'
    }
  },
  
  // Raw data from tracking
  rawData: {
    totalDistance: {
      type: Number,
      required: [true, 'Total distance is required'],
      min: [0, 'Total distance must be non-negative']
    },
    totalHours: {
      type: Number,
      required: [true, 'Total hours is required'],
      min: [0, 'Total hours must be non-negative']
    },
    daysWorked: {
      type: Number,
      required: [true, 'Days worked is required'],
      min: [0, 'Days worked must be non-negative']
    }
  },
  
  // Pricing configuration used
  pricingConfig: {
    vehicleType: {
      type: String,
      enum: ['CAR', 'MOTORCYCLE', 'BUS', 'JEEP', 'E_TRIKE'],
      required: true
    },
    category: {
      type: String,
      enum: ['DIGITAL', 'NON_DIGITAL'],
      required: true
    },
    materialType: {
      type: String,
      enum: ['LCD', 'BANNER', 'STICKER', 'HEADDRESS', 'POSTER'],
      required: true
    },
    distanceRate: {
      type: Number,
      required: true,
      min: 0
    },
    hoursRate: {
      type: Number,
      required: true,
      min: 0
    }
  },
  
  // Salary calculations
  calculations: {
    distanceComputation: {
      type: Number,
      required: [true, 'Distance computation is required'],
      min: [0, 'Distance computation must be non-negative']
    },
    hoursComputation: {
      type: Number,
      required: [true, 'Hours computation is required'],
      min: [0, 'Hours computation must be non-negative']
    },
    totalSalary: {
      type: Number,
      required: [true, 'Total salary is required'],
      min: [0, 'Total salary must be non-negative']
    }
  },
  
  // Status and metadata
  status: {
    type: String,
    enum: ['PENDING', 'CALCULATED', 'APPROVED', 'PAID', 'DISPUTED'],
    default: 'CALCULATED'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SuperAdmin'
  },
  approvedAt: {
    type: Date
  },
  paidAt: {
    type: Date
  },
  paymentReference: {
    type: String,
    trim: true
  },
  
  // Additional information
  notes: {
    type: String,
    trim: true
  },
  disputeReason: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for efficient queries
DriverSalaryCalculationSchema.index({ driverId: 1, 'calculationPeriod.startDate': -1 });
DriverSalaryCalculationSchema.index({ materialId: 1, 'calculationPeriod.startDate': -1 });
DriverSalaryCalculationSchema.index({ status: 1, 'calculationPeriod.startDate': -1 });

// Virtual for period display
DriverSalaryCalculationSchema.virtual('periodDisplay').get(function() {
  const start = this.calculationPeriod.startDate.toLocaleDateString();
  const end = this.calculationPeriod.endDate.toLocaleDateString();
  return `${start} - ${end}`;
});

// Virtual for driver info (will be populated)
DriverSalaryCalculationSchema.virtual('driver', {
  ref: 'Driver',
  localField: 'driverId',
  foreignField: 'driverId',
  justOne: true
});

// Method to calculate salary based on the formula
DriverSalaryCalculationSchema.methods.calculateSalary = function() {
  const { totalDistance, totalHours } = this.rawData;
  const { distanceRate, hoursRate } = this.pricingConfig;
  
  // Formula: TOTAL DISTANCE * SUPERADMIN SET PRICE = DISTANCE COMPUTATION
  const distanceComputation = totalDistance * distanceRate;
  
  // Formula: TOTAL HOURS (30 DAYS) * SUPERADMIN SET PRICE = HOURS COMPUTATION
  const hoursComputation = totalHours * hoursRate;
  
  // Formula: HOURS COMPUTATION (30DAYS) + DISTANCE COMPUTATION = DRIVER TOTAL SALARY
  const totalSalary = hoursComputation + distanceComputation;
  
  this.calculations = {
    distanceComputation: Math.round(distanceComputation * 100) / 100,
    hoursComputation: Math.round(hoursComputation * 100) / 100,
    totalSalary: Math.round(totalSalary * 100) / 100
  };
  
  return this.calculations;
};

// Static method to create calculation with automatic salary computation
DriverSalaryCalculationSchema.statics.createCalculation = async function(data) {
  const calculation = new this(data);
  calculation.calculateSalary();
  return calculation.save();
};

module.exports = mongoose.model('DriverSalaryCalculation', DriverSalaryCalculationSchema);
