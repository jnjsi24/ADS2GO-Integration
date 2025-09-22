const ffprobe = require('ffprobe-static');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class VideoDurationService {
  /**
   * Get video duration from a video URL
   * @param {string} videoUrl - The URL of the video file
   * @returns {Promise<number>} - Duration in seconds
   */
  static async getVideoDuration(videoUrl) {
    try {
      console.log(`🎬 Detecting video duration for: ${videoUrl}`);
      
      // Use ffprobe to get video metadata
      const command = `"${ffprobe.path}" -v quiet -show_entries format=duration -of csv="p=0" "${videoUrl}"`;
      
      const { stdout, stderr } = await execAsync(command);
      
      if (stderr) {
        console.error('ffprobe stderr:', stderr);
      }
      
      const duration = parseFloat(stdout.trim());
      
      if (isNaN(duration) || duration <= 0) {
        throw new Error('Invalid duration detected');
      }
      
      console.log(`✅ Video duration detected: ${duration} seconds`);
      return Math.round(duration);
      
    } catch (error) {
      console.error('❌ Error detecting video duration:', error.message);
      
      // Fallback: try to get duration from HTTP headers
      try {
        const response = await fetch(videoUrl, { method: 'HEAD' });
        const contentLength = response.headers.get('content-length');
        
        if (contentLength) {
          // Very rough estimate: assume 1MB per 10 seconds for video
          const estimatedDuration = Math.round((parseInt(contentLength) / 1024 / 1024) * 10);
          console.log(`⚠️ Using estimated duration: ${estimatedDuration} seconds (from file size)`);
          return Math.max(estimatedDuration, 5); // Minimum 5 seconds
        }
      } catch (headerError) {
        console.error('❌ Error getting video headers:', headerError.message);
      }
      
      // Final fallback: return a default duration
      console.log('⚠️ Using default duration: 30 seconds');
      return 30;
    }
  }
  
  /**
   * Update ad duration to match actual video duration
   * @param {string} adId - The ad ID to update
   * @param {string} videoUrl - The video URL
   * @returns {Promise<boolean>} - Success status
   */
  static async updateAdDuration(adId, videoUrl) {
    try {
      const Ad = require('../models/Ad');
      
      // Get actual video duration
      const actualDuration = await this.getVideoDuration(videoUrl);
      
      // Update the ad record
      const updatedAd = await Ad.findByIdAndUpdate(
        adId,
        { adLengthSeconds: actualDuration },
        { new: true }
      );
      
      if (updatedAd) {
        console.log(`✅ Updated ad ${adId} duration from plan duration to actual video duration: ${actualDuration}s`);
        return true;
      } else {
        console.error(`❌ Ad ${adId} not found`);
        return false;
      }
      
    } catch (error) {
      console.error('❌ Error updating ad duration:', error.message);
      return false;
    }
  }
}

module.exports = VideoDurationService;
