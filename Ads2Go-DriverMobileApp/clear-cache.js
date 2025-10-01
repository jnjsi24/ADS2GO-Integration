const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🧹 Clearing Metro cache and node_modules...');

try {
  // Clear Metro cache
  console.log('Clearing Metro cache...');
  execSync('npx expo start --clear', { stdio: 'inherit' });
} catch (error) {
  console.log('Metro clear failed, trying alternative...');
  
  // Alternative: Clear cache directories manually
  const cacheDirs = [
    path.join(__dirname, '.expo'),
    path.join(__dirname, 'node_modules/.cache'),
    path.join(__dirname, '.metro'),
  ];
  
  cacheDirs.forEach(dir => {
    if (fs.existsSync(dir)) {
      console.log(`Removing ${dir}...`);
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
  
  console.log('✅ Cache cleared. Please restart the development server.');
}
