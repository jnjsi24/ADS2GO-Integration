const fetch = require('node-fetch');

const API_BASE_URL = 'http://192.168.100.22:5000';

async function testTabletRegistration() {
  console.log('🧪 Testing Tablet Registration Flow...\n');

  // Test data
  const testData = {
    deviceId: 'TABLET-TEST-001',
    materialId: '68b1f45b9384e0cec97f66aa', // Replace with actual material ID
    slotNumber: 1,
    carGroupId: 'GRP-E522A5CC'
  };

  try {
    // Test 1: Register Tablet
    console.log('1️⃣ Testing tablet registration...');
    const registerResponse = await fetch(`${API_BASE_URL}/registerTablet`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData),
    });

    const registerResult = await registerResponse.json();
    console.log('Registration Response:', JSON.stringify(registerResult, null, 2));

    if (registerResult.success) {
      console.log('✅ Tablet registration successful!\n');

      // Test 2: Update Tablet Status
      console.log('2️⃣ Testing tablet status update...');
      const statusResponse = await fetch(`${API_BASE_URL}/updateTabletStatus`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deviceId: testData.deviceId,
          isOnline: true,
          gps: {
            lat: 14.5995,
            lng: 120.9842
          }
        }),
      });

      const statusResult = await statusResponse.json();
      console.log('Status Update Response:', JSON.stringify(statusResult, null, 2));

      if (statusResult.success) {
        console.log('✅ Tablet status update successful!\n');
      }

      // Test 3: Get Tablet Info
      console.log('3️⃣ Testing get tablet info...');
      const infoResponse = await fetch(`${API_BASE_URL}/tablet/${testData.deviceId}`);
      const infoResult = await infoResponse.json();
      console.log('Get Tablet Info Response:', JSON.stringify(infoResult, null, 2));

      if (infoResult.success) {
        console.log('✅ Get tablet info successful!\n');
      }

    } else {
      console.log('❌ Tablet registration failed:', registerResult.message);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testTabletRegistration();
