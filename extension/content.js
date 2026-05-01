// =====================================================================
// 🛡️ LAYER 1: ZERO-DAY PHISHING & TYPOSQUATTING DEFENSE
// =====================================================================

const PROTECTED_DOMAINS = [
  'app.uniswap.org', // <--- Add this just for the demo
  'uniswap.org',
  'aave.com',
  'opensea.io',
  'blur.io',
  'curve.fi',
  'pancakeswap.finance',
  'lido.fi',
  'makerdao.com',
  'microsoft.com' 
];

function levenshteinDistance(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
      }
    }
  }
  return matrix[b.length][a.length];
}
// =====================================================================
// 🛡️ LAYER 2: AI DOM NLP & SOCIAL ENGINEERING SHIELD
// =====================================================================

function scanPageForSocialEngineering() {
  // Grab text from the page, clean it up, take the first 1500 chars
  const pageText = document.body.innerText.replace(/\s+/g, ' ').toLowerCase().substring(0, 1500);
  
  // High-risk Web3 phishing keywords (FOMO, urgency, fake promises)
  const riskKeywords = [
    'claim airdrop', 'limited time', 'multiplier', 'guaranteed return', 
    'connect to claim', 'verify your wallet', 'double your', 'giveaway',
    'eligibility check', 'hurry', 'airdrop'
  ];
  
  let riskScore = 0;
  const foundTriggers = [];

  riskKeywords.forEach(word => {
    if (pageText.includes(word)) {
      riskScore += 25;
      foundTriggers.push(word);
    }
  });

  // If score is high enough, trigger the UI warning
  if (riskScore >= 50) {
    injectPhishingBanner(foundTriggers);
  }
}

function injectPhishingBanner(triggers) {
  // Don't inject twice
  if (document.getElementById('cg-phishing-banner')) return;

  const banner = document.createElement('div');
  banner.id = 'cg-phishing-banner';
  banner.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; gap: 12px; padding: 12px; background: rgba(255, 59, 59, 0.1); border-bottom: 1px solid rgba(255, 59, 59, 0.3); backdrop-filter: blur(10px); color: #FF3B3B; font-family: system-ui, sans-serif; font-size: 13px; z-index: 2147483647; position: fixed; top: 0; left: 0; right: 0;">
      <span style="font-size: 16px;">🚨</span>
      <strong>ChainGuardian AI Warning:</strong> High social engineering risk detected on this page. 
      <span style="opacity: 0.8;">(Triggers: ${triggers.slice(0,2).join(', ')})</span>
      <button onclick="this.parentElement.remove()" style="background: transparent; border: 1px solid #FF3B3B; color: #FF3B3B; border-radius: 4px; padding: 4px 8px; margin-left: 12px; cursor: pointer; font-size: 11px;">Dismiss</button>
    </div>
  `;
  document.body.prepend(banner);
}

// Run the scan exactly 1.5 seconds after the page loads to ensure React/Vue apps have rendered text
window.addEventListener('load', () => {
  setTimeout(scanPageForSocialEngineering, 1500);
});
function checkDomainPhishing() {
  const currentHostname = window.location.hostname.replace(/^www\./, '').toLowerCase();
  if (PROTECTED_DOMAINS.includes(currentHostname) || currentHostname === 'localhost' || currentHostname === '127.0.0.1') {
    return null; 
  }
  for (const target of PROTECTED_DOMAINS) {
    const distance = levenshteinDistance(currentHostname, target);
    if (distance > 0 && distance <= 2 && Math.abs(currentHostname.length - target.length) <= 2) {
      return { fake: currentHostname, real: target };
    }
  }
  return null; 
}

console.log("🔥 ChainGuardian MAIN WORLD HOOKED");
(function () {
  const BACKEND = 'http://localhost:3000';
  const RISK_THRESHOLD = 0;

  // ─── Patch ethereum provider ─────────────────────────────────────────────────
  function patchProvider(provider) {
    if (!provider || provider.__chainGuardianPatched) return;
    provider.__chainGuardianPatched = true;

    const originalRequest = provider.request.bind(provider);

    provider.request = async function (args) {
      const { method, params } = args;

      if (method === 'eth_sendTransaction' && params && params[0]) {
        const tx = params[0];
        // HACKATHON DEMO MODE: Intercept ALL transactions
        const isHighRisk = true; 

        if (isHighRisk) {
          try {
            const result = await analyzeTransaction(tx);

            if (result.risk >= RISK_THRESHOLD) {
              const userChoice = await showRiskPopup(result, tx);

              if (userChoice === 'block') {
                console.log('[ChainGuardian] BLOCKED');
                const err = new Error('ChainGuardian: transaction blocked by user');
                err.code = 4001; 
                return Promise.reject(err);
              } else {
                logIntent(tx, result).catch(() => {});
                return originalRequest(args);
              }
            }
            return originalRequest(args);
          } catch (e) {
            console.warn('[ChainGuardian] Error:', e.message);
            return Promise.reject(e);
          }
        }
      }
      return originalRequest(args);
    };
  } 

  // ─── Analyze transaction via backend ─────────────────────────────────────────
  async function analyzeTransaction(tx) {
    return new Promise((resolve) => {
      window.addEventListener('CG_RESPONSE_READY', (e) => {
        try {
          const data = JSON.parse(e.detail);
          resolve(data);
        } catch (err) {
          resolve(localFallbackCheck(tx));
        }
      }, { once: true });

      const payload = JSON.stringify({ tx });
      const event = new CustomEvent('CG_REQUEST_ANALYSIS', { detail: payload });
      window.dispatchEvent(event);

      setTimeout(() => resolve(localFallbackCheck(tx)), 15000);
    });
  }

  // ─── Local fallback when backend is down ─────────────────────────────────────
  function localFallbackCheck(tx) {
    let score = 0;
    const flags = [];

    if (tx.data && tx.data.includes('ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')) {
      score += 35;
      flags.push('Unlimited approval detected');
    }

    if (!tx.to || tx.to === '0x0000000000000000000000000000000000000000') {
      score += 30;
      flags.push('Zero or missing recipient address');
    }

    return {
      risk: Math.min(score, 100),
      aiExplain: '⚠️ Backend offline – basic check only. ' + (flags.join(', ') || 'No local flags found.'),
      slither: [],
      whale: 0,
      checks: { unlimited: score > 0 },
      offline: true
    };
  }

  // ─── Show risk popup ─────────────────────────────────────────────────────────
  // ─── Show risk popup ─────────────────────────────────────────────────────────
// ─── Show risk popup ─────────────────────────────────────────────────────────
function showRiskPopup(result, tx) {
  return new Promise((resolve) => {
    const existing = document.getElementById('cg-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'cg-overlay';

    const riskColor = result.risk >= 80 ? '#FF3B3B' : result.risk >= 50 ? '#FF8C00' : '#00FF88';
    const riskLabel = result.risk >= 80 ? 'CRITICAL DANGER' : result.risk >= 50 ? 'HIGH RISK' : 'LOW RISK';

    let pillHtml = result.risk < 50 
      ? `<div class="cg-pill" style="background: rgba(0, 255, 136, 0.15); color: #00ff88; border: 1px solid rgba(0, 255, 136, 0.3);"><span>✓</span> VERIFIED SAFE</div>`
      : `<div class="cg-pill" style="background: rgba(255, 59, 59, 0.15); color: #FF3B3B; border: 1px solid rgba(255, 59, 59, 0.3);"><span>🚨</span> MALICIOUS TARGET</div>`;

    const rawAiText = result.aiExplain || 'Risk signals detected.';
    const aiSentences = rawAiText.split('. ').filter(s => s.trim().length > 0);
    const aiBulletsHtml = aiSentences.map(sentence => `
      <div class="cg-ai-bullet">
        <span class="cg-bullet-icon">✦</span>
        <span class="cg-bullet-text">${escHtml(sentence.replace(/\.$/, ''))}.</span>
      </div>
    `).join('');

    let hindiMsg = result.risk >= 80 
      ? `🇮🇳 यह लेनदेन खतरनाक है! ${result.risk}% जोखिम – अपना पैसा बचाएं, BLOCK करें! 🛑`
      : `🇮🇳 यह लेनदेन सुरक्षित है। ${result.risk}% जोखिम – आप आगे बढ़ सकते हैं।`;

    const domainWarning = checkDomainPhishing();

    // DYNAMIC BUTTON LOGIC
    let actionBtnsHtml = '';
    if (result.risk < 50) {
      // Safe UI
      actionBtnsHtml = `
        <button id="cg-btn-cancel" class="cg-btn-secondary">Go Back</button>
        <button id="cg-btn-proceed" class="cg-btn-primary-safe">✅ Proceed Safely</button>
      `;
    } else {
      // Danger UI
      actionBtnsHtml = `
        <button id="cg-btn-block" class="cg-btn-primary-danger">🛡️ BLOCK TRANSACTION</button>
        <button id="cg-btn-force" class="cg-btn-secondary">Force Approve</button>
      `;
    }

    overlay.innerHTML = `
      <style>
        #cg-overlay {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(4, 4, 9, 0.9);
          z-index: 2147483647;
          display: flex; align-items: center; justify-content: center;
          font-family: 'Segoe UI', system-ui, sans-serif;
          backdrop-filter: blur(8px);
        }
        
        #cg-card {
          background: rgba(13, 13, 21, 0.85);
          position: relative;
          overflow: hidden; 
          border: 1px solid transparent; 
          border-image: linear-gradient(to bottom right, ${riskColor}, rgba(255,255,255,0.1)) 1;
          backdrop-filter: blur(20px); 
          -webkit-backdrop-filter: blur(20px);
          padding: 32px;
          max-width: 480px; width: 95%;
          max-height: 90vh;
          overflow-y: auto;
          animation: cgSlideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }

        #cg-card::after {
          content: ''; position: absolute; top: -50%; left: -150%; width: 200%; height: 200%;
          background: linear-gradient(45deg, transparent, rgba(255,255,255,0.05), transparent);
          transform: rotate(45deg);
          animation: scanRay 3s ease-in-out infinite;
          pointer-events: none;
        }

        @keyframes scanRay { 0% { left: -150%; } 100% { left: 150%; } }

        #cg-risk-score {
          font-size: 72px; font-weight: 950; letter-spacing: -4px; margin: 0;
          background: linear-gradient(to bottom, #fff, ${riskColor});
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          filter: drop-shadow(0 0 25px ${riskColor}66);
          line-height: 1;
        }

        #cg-card::-webkit-scrollbar { width: 6px; }
        #cg-card::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }

        @keyframes cgSlideIn { from { transform: translateY(40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        
        .cg-pill { display: inline-flex; align-items: center; gap: 6px; padding: 6px 16px; border-radius: 30px; font-size: 11px; font-weight: 800; text-transform: uppercase; margin-bottom: 16px; }
        .cg-ai-bullet { display: flex; align-items: flex-start; gap: 10px; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.05); padding: 12px 16px; border-radius: 12px; margin-bottom: 8px; }
        .cg-bullet-icon { color: ${riskColor}; font-size: 14px; }
        .cg-bullet-text { color: #E2E8F0; font-size: 14px; line-height: 1.5; }

        #cg-details-pane { display: none; margin-top: 20px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 20px; }
        .cg-table { width: 100%; border-collapse: collapse; font-size: 12px; background: #000; border-radius: 8px; }
        .cg-table th { color: #666; padding: 10px; text-align: left; }
        .cg-table td { padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.05); color: #ccc; }
        .cg-highlight { color: ${riskColor}; font-weight: 700; }

        #cg-toggle-details { background: transparent; color: #888; border: none; font-size: 11px; cursor: pointer; margin: 16px auto; display: block; text-transform: uppercase; }
        #cg-hindi { color: #f0c040; font-size: 13px; background: rgba(240, 192, 64, 0.1); border-radius: 8px; padding: 12px; margin-bottom: 20px; border: 1px solid rgba(240, 192, 64, 0.2); text-align: center; }
        
        /* DYNAMIC BUTTON STYLES */
        #cg-btns { display: flex; gap: 12px; }
        .cg-btn-primary-danger { flex: 1; background: #FF3B3B; color: #fff; border: none; border-radius: 12px; padding: 16px; font-weight: 800; font-size: 14px; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 15px rgba(255,59,59,0.3); }
        .cg-btn-primary-danger:hover { transform: translateY(-2px); filter: brightness(1.1); box-shadow: 0 8px 25px rgba(255,59,59,0.5); }
        
        .cg-btn-primary-safe { flex: 1; background: #00FF88; color: #000; border: none; border-radius: 12px; padding: 16px; font-weight: 800; font-size: 14px; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 15px rgba(0,255,136,0.3); }
        .cg-btn-primary-safe:hover { transform: translateY(-2px); filter: brightness(1.1); box-shadow: 0 8px 25px rgba(0,255,136,0.5); }
        
        .cg-btn-secondary { flex: 1; background: rgba(255,255,255,0.03); color: #888; border: 1px solid #333; border-radius: 12px; padding: 16px; font-weight: 600; font-size: 13px; cursor: pointer; transition: all 0.2s; }
        .cg-btn-secondary:hover { border-color: #666; color: #fff; background: rgba(255,255,255,0.08); }
      </style>
      
      <div id="cg-card">
        <div style="text-align: center; margin-bottom: 24px;">
          ${pillHtml}
          <h1 id="cg-risk-score">${result.risk}%</h1>
          <p style="color: ${riskColor}; font-size: 11px; font-weight: 800; letter-spacing: 4px; text-transform: uppercase;">${riskLabel}</p>
        </div>
        
        <div id="cg-ai-container">${aiBulletsHtml}</div>

        <button id="cg-toggle-details">📊 View Analysis Data ▾</button>

        <div id="cg-details-pane">
          <table class="cg-table">
            <thead><tr><th>Factor</th><th>Value</th><th>Impact</th></tr></thead>
            <tbody>
              <tr><td>Domain</td><td>${domainWarning ? `<span style="color:#FF3B3B">Phishing: ${domainWarning.fake}</span>` : 'Verified Safe'}</td><td class="cg-highlight">${domainWarning ? 'FATAL' : '+0'}</td></tr>
              <tr><td>Whale</td><td>${result.whale > 0 ? result.whale + '% Top Holder' : 'Decentralized'}</td><td class="cg-highlight">+${result.whale > 50 ? '25' : '0'}</td></tr>
              <tr><td>Slither</td><td>${result.slither ? result.slither.length : 0} Vulnerabilities</td><td class="cg-highlight">+${result.slither && result.slither.length > 0 ? '20' : '0'}</td></tr>
              <tr><td>Approval</td><td>${result.checks && result.checks.unlimited ? '<span style="color:#FF3B3B">uint256.max</span>' : 'Standard Limit'}</td><td class="cg-highlight">+${result.checks && result.checks.unlimited ? '20' : '0'}</td></tr>
              <tr><td>Simulation</td><td>${result.checks && result.checks.drainDetected ? '<span style="color:#FF3B3B">Balance Drain</span>' : 'Safe Execution'}</td><td class="cg-highlight">+${result.checks && result.checks.drainDetected ? '25' : '0'}</td></tr>
              <tr><td>GoPlus API</td><td>${result.checks && result.checks.honeypot ? '<span style="color:#FF3B3B">Honeypot Detected</span>' : 'Clean Token'}</td><td class="cg-highlight">+${result.checks && result.checks.honeypot ? 'FATAL' : '0'}</td></tr>
            </tbody>
          </table>
        </div>
        
        <div id="cg-hindi">${hindiMsg}</div>
        
        <div id="cg-btns">
          ${actionBtnsHtml}
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // DYNAMIC BUTTON LISTENERS
    if (result.risk < 50) {
      document.getElementById('cg-btn-proceed').onclick = () => { overlay.remove(); resolve('approve'); };
      document.getElementById('cg-btn-cancel').onclick = () => { overlay.remove(); resolve('block'); };
    } else {
      document.getElementById('cg-btn-block').onclick = () => { overlay.remove(); resolve('block'); };
      document.getElementById('cg-btn-force').onclick = () => { overlay.remove(); resolve('approve'); };
    }
    
    const toggleBtn = document.getElementById('cg-toggle-details');
    const detailsPane = document.getElementById('cg-details-pane');

    toggleBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (detailsPane.style.display === 'block') {
        detailsPane.style.display = 'none';
        toggleBtn.innerHTML = '📊 VIEW ANALYSIS DATA ▾';
      } else {
        detailsPane.style.display = 'block';
        toggleBtn.innerHTML = '▴ HIDE ANALYSIS DATA';
        document.getElementById('cg-card').scrollTo({ top: document.getElementById('cg-card').scrollHeight, behavior: 'smooth' });
      }
    };

    const keyHandler = (e) => {
      if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', keyHandler); resolve('block'); }
    };
    document.addEventListener('keydown', keyHandler);
  });
}

  // ─── Log intent on-chain ──────────────────────────────────────────────────────
  async function logIntent(tx, result) {
    console.log('[ChainGuardian] Intent logged (bypassed for demo)');
  }

  // ─── HTML escape helper ───────────────────────────────────────────────────────
  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ─── AGGRESSIVE INTERCEPTOR ────────────────────────────────────────────────
  function startGuardian() {
    let _eth = window.ethereum;
    Object.defineProperty(window, 'ethereum', {
      get() { return _eth; },
      set(val) {
        _eth = val;
        if (val) patchProvider(val);
      },
      configurable: true
    });

    if (window.ethereum) patchProvider(window.ethereum);

    const obs = new MutationObserver(() => {
      if (window.ethereum && !window.ethereum.__chainGuardianPatched) {
        patchProvider(window.ethereum);
      }
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
  }

  startGuardian();
  console.log('%c[ChainGuardian] 🛡️ AGGRESSIVE MODE ACTIVE', 'color:#00ff88;font-weight:bold;');
})();