/**
 * Driver Salary Report Configuration
 * 
 * Copy this file to driver-config.js and update the values
 * The script will automatically use this configuration if it exists
 * 
 * Example:
 *   cp driver-config.example.js driver-config.js
 */

module.exports = {
  // Driver credentials
  driver: {
    email: 'xyrillelopez5@gmail.com',
    password: 'Password@123'
  },
  
  // Report settings
  report: {
    // Number of days to include in the report (default: 30)
    days: 30,
    
    // Show detailed daily breakdown (default: true)
    showDailyBreakdown: true,
    
    // Number of recent days to show in daily breakdown (default: 10)
    dailyBreakdownDays: 10,
    
    // Export report to file (default: false)
    exportToFile: false,
    
    // Output file path (only used if exportToFile is true)
    outputFilePath: './reports/driver_salary_report.txt'
  },
  
  // Database connection (optional - will use .env if not specified)
  database: {
    // MongoDB connection string
    // Leave as null to use environment variables
    uri: null // Example: 'mongodb://localhost:27017/ads2go'
  }
};
