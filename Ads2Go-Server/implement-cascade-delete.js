// This is a reference implementation for cascade delete logic
// You should add this to your adResolver.js deleteAd function

const deleteAdWithCascade = async (adId, user) => {
  try {
    // 1. Find the ad first
    const ad = await Ad.findById(adId);
    if (!ad) {
      throw new Error('Ad not found');
    }

    // 2. Remove ad from all deployments
    const deployments = await AdsDeployment.find({
      $or: [
        { adId: adId },
        { 'lcdSlots.adId': adId }
      ]
    });

    for (const deployment of deployments) {
      // Remove from LCD slots
      if (deployment.lcdSlots && deployment.lcdSlots.length > 0) {
        deployment.lcdSlots = deployment.lcdSlots.filter(slot => 
          slot.adId.toString() !== adId.toString()
        );
        await deployment.save();
      }
      
      // Remove from non-LCD deployment
      if (deployment.adId && deployment.adId.toString() === adId.toString()) {
        deployment.adId = null;
        await deployment.save();
      }
    }

    // 3. Delete analytics records
    await Analytics.deleteMany({ adId: adId });

    // 4. Update payment records (set adId to null instead of deleting)
    await Payment.updateMany(
      { adsId: adId },
      { $unset: { adsId: 1 } }
    );

    // 5. Remove from material availability
    await MaterialAvailabilityService.removeAdFromMaterials(adId);

    // 6. Delete the ad
    await Ad.findByIdAndDelete(adId);

    console.log(`✅ Ad ${adId} and all related records deleted successfully`);
    return true;

  } catch (error) {
    console.error('Error in cascade delete:', error);
    throw error;
  }
};
