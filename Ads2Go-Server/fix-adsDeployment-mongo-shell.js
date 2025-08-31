// MongoDB Shell Script to Fix AdsDeployment materialId
// Run this script in MongoDB shell or MongoDB Compass

// Connect to your database
use ADSTOGO;

// Find all AdsDeployment records with ObjectId materialId
var deployments = db.adsdeployments.find({
  materialId: { $regex: /^[0-9a-fA-F]{24}$/ }
});

print("Found " + deployments.count() + " AdsDeployment records with ObjectId materialId");

// Process each deployment
deployments.forEach(function(deployment) {
  print("Processing deployment: " + deployment._id);
  print("  Current materialId: " + deployment.materialId);
  
  // Find the material by ObjectId
  var material = db.materials.findOne({ _id: ObjectId(deployment.materialId) });
  
  if (material && material.materialId) {
    print("  Found material: " + material.materialId);
    
    // Update the deployment with the string materialId
    var result = db.adsdeployments.updateOne(
      { _id: deployment._id },
      { $set: { materialId: material.materialId } }
    );
    
    if (result.modifiedCount > 0) {
      print("  ✅ Successfully updated to: " + material.materialId);
    } else {
      print("  ❌ Failed to update");
    }
  } else {
    print("  ❌ Material not found");
  }
});

// Verify the fix
var remainingObjectIdDeployments = db.adsdeployments.find({
  materialId: { $regex: /^[0-9a-fA-F]{24}$/ }
});

print("\nVerification:");
print("Remaining deployments with ObjectId materialId: " + remainingObjectIdDeployments.count());

if (remainingObjectIdDeployments.count() === 0) {
  print("✅ All AdsDeployment records now use string materialId");
} else {
  print("⚠️  Some deployments still have ObjectId materialId:");
  remainingObjectIdDeployments.forEach(function(d) {
    print("  - " + d._id + ": " + d.materialId);
  });
}

print("\nMigration completed!");
