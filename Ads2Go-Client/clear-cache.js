// Cache clearing script
console.log('🧹 Clearing browser cache...');

// Force reload with cache bypass
if (typeof window !== 'undefined') {
  // Clear all caches
  if ('caches' in window) {
    caches.keys().then(function(names) {
      for (let name of names) {
        caches.delete(name);
      }
    });
  }
  
  // Force reload
  window.location.reload(true);
}
