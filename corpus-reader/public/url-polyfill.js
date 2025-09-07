// URL.parse polyfill for Android WebView compatibility
// This polyfill addresses the missing URL.parse method that PDF.js tries to use
(function() {
  'use strict';
  
  // Check if URL.parse already exists (Node.js environment)
  if (typeof URL !== 'undefined' && !URL.parse) {
    // Add the URL.parse method using the standard URL constructor
    URL.parse = function(urlString, base) {
      try {
        if (typeof urlString !== 'string') {
          return null;
        }
        
        // Handle relative URLs with base
        if (base) {
          return new URL(urlString, base);
        }
        
        // Handle absolute URLs
        return new URL(urlString);
      } catch (error) {
        // Return null for invalid URLs (matching Node.js behavior)
        console.warn('[URL.parse polyfill] Invalid URL:', urlString, error.message);
        return null;
      }
    };
    
    console.log('[URL.parse polyfill] URL.parse method added for browser compatibility');
  }
  
  // Additional polyfills for older Android WebViews if needed
  if (typeof URL !== 'undefined' && !URL.canParse) {
    URL.canParse = function(urlString, base) {
      try {
        if (base) {
          new URL(urlString, base);
        } else {
          new URL(urlString);
        }
        return true;
      } catch {
        return false;
      }
    };
  }
})();
