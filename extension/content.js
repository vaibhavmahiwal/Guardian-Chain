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
        /*const isHighRisk = tx.data && (
          tx.data.startsWith('0x095ea7b3') || // approve
          tx.data.startsWith('0xe8fffeb5') || // addLiquidity
          tx.data.startsWith('0x38ed1739') || // swapExactTokensForTokens
          tx.data.startsWith('0xa9059cbb')    // transfer
        ); */

        if (isHighRisk) {
          try {
            const result = await analyzeTransaction(tx);

            if (result.risk >= RISK_THRESHOLD) {
              // FIX #2 & #3: Use the custom popup UI and the correct field (aiExplain)
              const userChoice = await showRiskPopup(result, tx);

              if (userChoice === 'block') {
                console.log('[ChainGuardian] BLOCKED');
                const err = new Error('ChainGuardian: transaction blocked by user');
                err.code = 4001; // EIP-1193 user rejected — prevents dApp retry loops
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
  } // FIX #1: This closing brace was missing — patchProvider is now properly closed

  // ─── Analyze transaction via backend ─────────────────────────────────────────
// ─── Analyze transaction via backend (REAL CONNECTION) ─────────────────────
async function analyzeTransaction(tx) {
  return new Promise((resolve) => {
    // 1. Listen for the response first
    window.addEventListener('CG_RESPONSE_READY', (e) => {
      try {
        const data = JSON.parse(e.detail);
        resolve(data);
      } catch (err) {
        resolve(localFallbackCheck(tx));
      }
    }, { once: true });

    // 2. Dispatch the request to the bridge as a string
    const payload = JSON.stringify({ tx });
    const event = new CustomEvent('CG_REQUEST_ANALYSIS', { detail: payload });
    window.dispatchEvent(event);

    // 3. Fallback if background doesn't respond in 5 seconds
    setTimeout(() => resolve(localFallbackCheck(tx)), 5000);
  });
}

  // ─── Local fallback when backend is down ─────────────────────────────────────
  function localFallbackCheck(tx) {
    let score = 0;
    const flags = [];

    // Check unlimited approval (uint256.max)
    if (tx.data && tx.data.includes('ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')) {
      score += 35;
      flags.push('Unlimited approval detected');
    }

    // FIX #4: Check for zero-address recipient (a genuine risk signal) instead
    // of the broken mixed-case check which flagged valid checksummed addresses
    if (!tx.to || tx.to === '0x0000000000000000000000000000000000000000') {
      score += 30;
      flags.push('Zero or missing recipient address');
    }

    // FIX #5: Return aiExplain (not message) to match what showRiskPopup expects
    return {
      risk: Math.min(score, 100),
      aiExplain: '⚠️ Backend offline – basic check only. ' + (flags.join(', ') || 'No local flags found.'),
      slither: [],
      whale: 0,
      checks: { unlimited: score > 0 },
      offline: true
    };
  }

  // ─── Show risk popup ──────────────────────────────────────────────────────────
// ─── Show risk popup ──────────────────────────────────────────────────────────
function showRiskPopup(result, tx) {
  return new Promise((resolve) => {
    const existing = document.getElementById('cg-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'cg-overlay';

    // 1. DYNAMIC UI LOGIC (Red for Danger, Orange for Medium, Green for Safe)
    const riskColor = result.risk >= 80 ? '#FF3B3B' : result.risk >= 50 ? '#FF8C00' : '#00FF88';
    const riskEmoji = result.risk >= 80 ? '🚨' : result.risk >= 50 ? '⚠️' : '✅';
    const riskLabel = result.risk >= 80 ? 'DANGER' : result.risk >= 50 ? 'HIGH RISK' : 'SAFE / SECURE';

    // 2. DYNAMIC HINDI MESSAGING
    let hindiMsg = `🇮🇳 यह लेनदेन सुरक्षित है। ${result.risk}% जोखिम – आप आगे बढ़ सकते हैं।`;
    if (result.risk >= 80) hindiMsg = `🇮🇳 यह लेनदेन खतरनाक है! ${result.risk}% जोखिम – अपना पैसा बचाएं, BLOCK करें! 🛑`;
    else if (result.risk >= 50) hindiMsg = `🇮🇳 चेतावनी! ${result.risk}% जोखिम – सावधानी से सोचें।`;

    const slitherHtml = result.slither && result.slither.length > 0
      ? result.slither.slice(0, 3).map(s =>
          `<div class="cg-bug">🔴 Slither: ${escHtml(s)}</div>`
        ).join('')
      : '';

    const whaleHtml = result.whale > 0
      ? `<div class="cg-check">🐋 Whale concentration: <strong>${result.whale}%</strong> (top holder)</div>`
      : '';

    overlay.innerHTML = `
      <style>
        #cg-overlay {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.82);
          z-index: 2147483647;
          display: flex; align-items: center; justify-content: center;
          font-family: 'Segoe UI', system-ui, sans-serif;
          backdrop-filter: blur(4px);
        }
        #cg-card {
          background: #0D0D1A;
          border: 2px solid ${riskColor};
          border-radius: 16px;
          padding: 28px 32px;
          max-width: 480px; width: 90%;
          box-shadow: 0 0 60px ${riskColor}44;
          animation: cgSlideIn 0.3s cubic-bezier(0.34,1.56,0.64,1);
        }
        @keyframes cgSlideIn {
          from { transform: translateY(-30px) scale(0.95); opacity: 0; }
          to   { transform: translateY(0) scale(1); opacity: 1; }
        }
        #cg-risk-badge {
          font-size: 42px; font-weight: 900;
          color: ${riskColor};
          text-align: center; margin: 8px 0 4px;
          text-shadow: 0 0 30px ${riskColor}88;
        }
        #cg-label {
          text-align: center; color: ${riskColor};
          font-size: 13px; font-weight: 700; letter-spacing: 3px;
          text-transform: uppercase; margin-bottom: 16px;
        }
        #cg-title { font-size: 18px; font-weight: 700; color: #fff; margin-bottom: 4px; }
        #cg-ai { color: #ccc; font-size: 14px; line-height: 1.5; margin-bottom: 14px; border-left: 3px solid ${riskColor}; padding-left: 10px; }
        .cg-check { color: #bbb; font-size: 13px; margin: 5px 0; }
        .cg-bug { color: #ff6b6b; font-size: 13px; margin: 5px 0; background: #1a0808; padding: 4px 8px; border-radius: 4px; }
        #cg-hindi { color: #f0c040; font-size: 13px; background: #1a1500; border-radius: 6px; padding: 8px 10px; margin: 12px 0; }
        #cg-btns { display: flex; gap: 12px; margin-top: 18px; }
        #cg-block {
          flex: 1; background: #FF3B3B; color: #fff;
          border: none; border-radius: 10px; padding: 14px;
          font-size: 15px; font-weight: 700; cursor: pointer;
          transition: transform 0.1s, box-shadow 0.2s;
        }
        #cg-block:hover { transform: scale(1.02); box-shadow: 0 0 20px #FF3B3B88; }
        #cg-force {
          flex: 1; background: transparent; color: #888;
          border: 1px solid #444; border-radius: 10px; padding: 14px;
          font-size: 13px; cursor: pointer;
        }
        #cg-force:hover { border-color: #888; color: #ccc; }
        #cg-contract { font-size: 11px; color: #555; word-break: break-all; margin-top: 10px; }
        #cg-loading { color: #888; font-size: 12px; text-align: center; margin-top: 8px; }
        #cg-offline { color: #FF8C00; font-size: 11px; text-align: center; padding: 4px; }
      </style>
      <div id="cg-card">
        <div style="text-align:center; font-size:28px">${riskEmoji}</div>
        <div id="cg-risk-badge">${result.risk}% ${riskLabel}</div>
        <div id="cg-label">ChainGuardian AI Analysis</div>
        ${result.offline ? '<div id="cg-offline">⚡ Offline mode – backend unreachable</div>' : ''}
        <div id="cg-ai">${escHtml(result.aiExplain || 'Risk signals detected.')}</div>
        ${whaleHtml}
        ${slitherHtml}
        ${result.checks && result.checks.unlimited ? '<div class="cg-bug">🔴 Unlimited approval (uint256.max) detected</div>' : ''}
        ${result.checks && result.checks.unverified ? '<div class="cg-check">❌ Contract source unverified on Etherscan</div>' : ''}
        ${result.checks && result.checks.drainDetected ? '<div class="cg-bug">🔴 Balance drain detected in simulation</div>' : ''}
        <div id="cg-hindi">
          ${hindiMsg}
        </div>
        <div id="cg-contract">📍 Contract: ${tx.to || 'Unknown'}</div>
        <div id="cg-btns">
          <button id="cg-block">🛡️ BLOCK SAFE</button>
          <button id="cg-force">⚡ Force Approve →</button>
        </div>
        <div id="cg-loading">ChainGuardian v1.0 | Sepolia Demo | 8-check AI engine</div>
      </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById('cg-block').onclick = () => {
      overlay.remove();
      resolve('block');
    };

    document.getElementById('cg-force').onclick = () => {
      overlay.remove();
      resolve('approve');
    };

    const keyHandler = (e) => {
      if (e.key === 'Escape') {
        overlay.remove();
        document.removeEventListener('keydown', keyHandler);
        resolve('block');
      }
    };
    document.addEventListener('keydown', keyHandler);
  });
}

  // ─── Log intent on-chain ──────────────────────────────────────────────────────
// ─── Log intent on-chain ──────────────────────────────────────────────────────
async function logIntent(tx, result) {
  console.log('[ChainGuardian] Intent logged (bypassed for demo)');
  /* await fetch(`${BACKEND}/log-intent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: tx.from, spender: tx.to, amount: tx.value || '0', riskScore: result.risk })
  });
  */
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
  // 1. Trap the setter: If Uniswap tries to use MetaMask, we patch it instantly
  let _eth = window.ethereum;
  Object.defineProperty(window, 'ethereum', {
    get() { return _eth; },
    set(val) {
      _eth = val;
      if (val) patchProvider(val);
    },
    configurable: true
  });

  // 2. Patch immediately if MetaMask is already there
  if (window.ethereum) patchProvider(window.ethereum);

  // 3. Mutation fallback for dynamic pages
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
  // ─── Hook all providers (MetaMask, Rabby, OKX, Coinbase) ─────────────────────
  /*function hookAllProviders() {
    if (window.ethereum) {
      patchProvider(window.ethereum);

      if (window.ethereum.providers) {
        window.ethereum.providers.forEach(patchProvider);
      }
    }

    if (window.okxwallet) patchProvider(window.okxwallet);
    if (window.coinbaseWalletExtension) patchProvider(window.coinbaseWalletExtension);

    const observer = new MutationObserver(() => {
      if (window.ethereum && !window.ethereum.__chainGuardianPatched) {
        patchProvider(window.ethereum);
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  // ─── Override ethereum property to catch late setters ────────────────────────
  // This must run BEFORE hookAllProviders so the setter intercepts the wallet's
  // own injection (wallets set window.ethereum on DOMContentLoaded or earlier).
  // If a dApp caches provider.request before we patch, we can't help that call —
  // but this catches the vast majority of real-world injection timing.
  let _ethereum = window.ethereum;
  Object.defineProperty(window, 'ethereum', {
    get() { return _ethereum; },
    set(val) {
      _ethereum = val;
      patchProvider(val); // patch immediately when wallet injects
    },
    configurable: true
  });

  // Run immediately (catches already-present providers)
  hookAllProviders();
  // Run again after DOM + scripts settle (catches late injectors)
  window.addEventListener('load', hookAllProviders);
  // Diagnostic: if you DON'T see this log, the script itself isn't running in MAIN world
  console.log('%c[ChainGuardian] 🛡️ Active – protecting all wallet providers', 'color:#00ff88;font-weight:bold;font-size:14px');
  console.log('[ChainGuardian] window.ethereum at boot:', typeof window.ethereum);
})(); */