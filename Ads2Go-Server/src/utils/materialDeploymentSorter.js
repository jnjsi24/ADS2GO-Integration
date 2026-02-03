/**
 * Utility to sort materials by the number of ads deployed (lowest first)
 * with randomization for materials with the same count
 * 
 * @param {Array} materials - Array of Material documents
 * @returns {Promise<Array>} Sorted array of materials (lowest ad count first)
 */
async function sortMaterialsByAdCount(materials) {
  if (!materials || materials.length === 0) {
    return materials;
  }

  const AdsDeployment = require('../models/adsDeployment');

  // Count ads for each material
  console.log(`📊 [sortMaterialsByAdCount] Counting ads for ${materials.length} materials...`);
  const materialAdCounts = await Promise.all(
    materials.map(async (material) => {
      let adCount = 0;

      try {
        // Find deployment for this material
        // materialId is a string field in Material model (e.g., "DGL-LCD-CAR-001")
        if (!material.materialId) {
          console.warn(`⚠️ Material missing materialId, skipping ad count`);
          return { material, adCount: 0 };
        }
        
        const deployment = await AdsDeployment.findOne({ 
          materialId: material.materialId
        });

        if (deployment) {
          if (material.materialType === 'LCD') {
            // For LCD: count active slots in lcdSlots array
            adCount = deployment.lcdSlots.filter(slot => 
              ['RUNNING', 'SCHEDULED'].includes(slot.status) && slot.adId
            ).length;
          } else if (material.materialType === 'HEADDRESS') {
            // For HEADDRESS: count active ads
            // HEADDRESS can have ads in lcdSlots (shared across tablet slots) or adId field
            if (deployment.lcdSlots && deployment.lcdSlots.length > 0) {
              // Count unique active ads in lcdSlots
              const uniqueAdIds = new Set();
              deployment.lcdSlots.forEach(slot => {
                if (['RUNNING', 'SCHEDULED'].includes(slot.status) && slot.adId) {
                  uniqueAdIds.add(slot.adId.toString());
                }
              });
              adCount = uniqueAdIds.size;
            } else if (deployment.adId) {
              // Single ad deployment
              adCount = 1;
            }
          }
        }
        
        // Log each material's ad count for debugging
        console.log(`   📊 ${material.materialId} (${material.materialType}): ${adCount} ad(s) deployed`);
      } catch (error) {
        console.error(`⚠️ Error counting ads for material ${material.materialId}:`, error.message);
        // Default to 0 if there's an error
        adCount = 0;
      }

      return {
        material,
        adCount
      };
    })
  );

  // Group materials by ad count
  const groupedByCount = {};
  materialAdCounts.forEach(({ material, adCount }) => {
    if (!groupedByCount[adCount]) {
      groupedByCount[adCount] = [];
    }
    groupedByCount[adCount].push(material);
  });

  // Sort by ad count (ascending) and randomize within each group
  const sortedMaterials = [];
  const sortedCounts = Object.keys(groupedByCount)
    .map(Number)
    .sort((a, b) => a - b);

  sortedCounts.forEach(count => {
    const materialsInGroup = groupedByCount[count];
    
    // Randomize materials within the same count group
    // Fisher-Yates shuffle for true randomization
    const shuffled = [...materialsInGroup];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    sortedMaterials.push(...shuffled);
  });

  console.log(`📊 [sortMaterialsByAdCount] Sorted ${sortedMaterials.length} materials by ad count (lowest first, randomized within groups)`);
  
  // Always log the distribution for debugging
  console.log(`📊 [sortMaterialsByAdCount] Distribution:`);
  sortedCounts.forEach(count => {
    const groupSize = groupedByCount[count].length;
    const materialIds = groupedByCount[count].map(m => m.materialId).join(', ');
    console.log(`   ${groupSize} material(s) with ${count} ad(s): [${materialIds}]`);
  });
  
  // Log the final deployment order
  console.log(`📊 [sortMaterialsByAdCount] Final deployment order:`);
  sortedMaterials.forEach((material, index) => {
    const count = materialAdCounts.find(m => m.material._id.toString() === material._id.toString())?.adCount || 0;
    console.log(`   ${index + 1}. ${material.materialId} (${count} ad(s))`);
  });

  return sortedMaterials;
}

module.exports = {
  sortMaterialsByAdCount
};
