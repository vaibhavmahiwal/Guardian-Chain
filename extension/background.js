// background.js – MV3 Service Worker
// Handles extension lifecycle and cross-tab messaging
// background.js - The Security Bypass
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'ANALYZE_TX_REMOTE') {
    console.log('[ChainGuardian Background] Fetching risk for:', request.tx);
    
    fetch('http://localhost:3000/risk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tx: request.tx })
    })
    .then(response => response.json())
    .then(data => {
      console.log('[ChainGuardian Background] Success:', data);
      sendResponse(data);
    })
    .catch(err => {
      console.error('[ChainGuardian Background] Fetch failed:', err);
      sendResponse({ error: err.message, offline: true });
    });
    
    return true; // Keep the channel open for async fetch
  }
});