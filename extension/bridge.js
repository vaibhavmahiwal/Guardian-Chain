// bridge.js - Runs in ISOLATED world to bypass CSP
console.log('[ChainGuardian] Bridge loaded and listening.');

window.addEventListener('CG_REQUEST_ANALYSIS', (event) => {
  console.log('[ChainGuardian Bridge] Request received from webpage!');
  
  try {
    const data = JSON.parse(event.detail);
    
    // Ask background.js to do the fetch
    chrome.runtime.sendMessage({ type: 'ANALYZE_TX_REMOTE', tx: data.tx }, (response) => {
      console.log('[ChainGuardian Bridge] Response from background:', response);
      
      // Send the result back to content.js
      const reply = new CustomEvent('CG_RESPONSE_READY', { detail: JSON.stringify(response) });
      window.dispatchEvent(reply);
    });
  } catch (e) {
    console.error('[ChainGuardian Bridge] Error processing message:', e);
  }
});