// ai.js – AI Explanation Layer
// Uses Gemini 2.5 Flash SDK (Primary) with HuggingFace Inference API & Rule-based fallbacks
/*
import { GoogleGenerativeAI } from "@google/generative-ai";

const HF_KEY = process.env.HF_KEY;
const GEMINI_KEY = process.env.GEMINI_KEY;

// Initialize Gemini SDK
const genAI = GEMINI_KEY ? new GoogleGenerativeAI(GEMINI_KEY) : null;

// ─── 1. Gemini "Deep Audit" (Structured JSON) ─────────────────────────────────
async function geminiDeepAudit(riskScore, checks, txPayload) {
  if (!genAI) return null;

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json", // CRITICAL: Forces clean JSON output
        temperature: 0.2, // Low temp for highly accurate security analysis
      }
    });

    const prompt = `
      You are ChainGuardian, an elite Smart Contract Security Auditor protecting Indian crypto beginners.
      Analyze this transaction payload and local heuristic data. Find vulnerabilities static analysis misses.

      Local Risk Score: ${riskScore}/100
      Transaction Data: ${JSON.stringify(txPayload || {})}
      Heuristics: ${JSON.stringify(checks || {})}

      Return ONLY a JSON object exactly in this structure:
      {
        "aiRiskScore": <number 0-100>,
        "maliciousIntentDetected": <boolean>,
        "logicalVulnerabilities": ["<vuln 1>", "<vuln 2>"],
        "aiExplain": "<A short, punchy 2-sentence explanation of the specific risk. End each sentence with a period.>"
      }
    `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    return JSON.parse(responseText);
  } catch (e) {
    console.error("[ChainGuardian] Gemini SDK Error:", e.message);
    return null; // Triggers fallback
  }
}

// ─── Build old system prompt for Fallbacks ────────────────────────────────────
function buildPrompt(riskScore, flags, checks) {
  const flagList = flags.join(', ') || 'No major flags';
  return `You are ChainGuardian, a DeFi security AI.
Risk Score: ${riskScore}/100. Flags: ${flagList}.
Whale: ${checks.whale || 0}%. Slither: ${checks.slither?.length || 0}. 
Unlimited approval: ${checks.unlimited ? 'YES' : 'NO'}. Drain: ${checks.drainDetected ? 'YES' : 'NO'}.
Write ONE sentence explaining the danger. End with a period.`;
}

// ─── 2. HuggingFace fallback ──────────────────────────────────────────────────
async function hfExplain(prompt) {
  if (!HF_KEY) return null;
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 6000);

    const resp = await fetch(
      'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3',
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${HF_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputs: `<s>[INST] ${prompt} [/INST]`,
          parameters: { max_new_tokens: 120, temperature: 0.3, return_full_text: false }
        }),
        signal: ctrl.signal
      }
    );

    if (!resp.ok) return null;
    const data = await resp.json();
    const text = Array.isArray(data) ? data[0]?.generated_text : data?.generated_text;
    return text?.trim() || null;
  } catch {
    return null;
  }
}

// ─── 3. Rule-based fallback (no API needed) ───────────────────────────────────
function ruleBasedExplain(riskScore, flags, checks) {
  const parts = [];

  if (checks.drainDetected) parts.push('🚨 Simulation shows your tokens WILL be drained from this approval.');
  else if (checks.slither?.length > 0) parts.push(`🔴 Slither found ${checks.slither[0]} – a proven smart contract vulnerability.`);
  else if (checks.whale > 70) parts.push(`🐋 One wallet holds ${checks.whale}% of supply – classic rug pull setup.`);
  else if (checks.unlimited) parts.push('⚠️ Unlimited approval gives this contract access to ALL your tokens forever.');
  else if (checks.unverified) parts.push('❌ Contract source code is hidden – cannot verify what this contract does.');
  else parts.push(`⚠️ Risk score ${riskScore}% – multiple suspicious signals detected.`);

  if (riskScore >= 80) parts.push('🇮🇳 अपना पैसा बचाएं! यह लेनदेन खतरनाक है – BLOCK करें!');
  else if (riskScore >= 50) parts.push('🇮🇳 सावधान! यह contract संदिग्ध है।');
  else parts.push('🇮🇳 यह लेनदेन सुरक्षित है।');

  return parts.join(' ');
}

// ─── Main export ──────────────────────────────────────────────────────────────
export async function aiExplain(riskScore, flags, checks, txPayload = {}) {
  // Try the new Gemini Deep Audit first
  const geminiJson = await geminiDeepAudit(riskScore, checks, txPayload);

  if (geminiJson) {
    // Reconstruct the JSON into a bulleted string for the frontend UI
    let finalExplanation = geminiJson.aiExplain;
    
    if (geminiJson.logicalVulnerabilities && geminiJson.logicalVulnerabilities.length > 0) {
      finalExplanation += ` Deep Audit detected: ${geminiJson.logicalVulnerabilities.join(', ')}.`;
    }

    // Append dynamic Hindi localization
    if (geminiJson.aiRiskScore >= 80 || riskScore >= 80) {
      finalExplanation += ' 🇮🇳 अपना पैसा बचाएं! यह लेनदेन खतरनाक है, BLOCK करें!';
    } else if (geminiJson.aiRiskScore >= 50 || riskScore >= 50) {
      finalExplanation += ' 🇮🇳 चेतावनी! सावधानी से सोचें।';
    } else {
      finalExplanation += ' 🇮🇳 यह लेनदेन सुरक्षित है। आप आगे बढ़ सकते हैं।';
    }

    return finalExplanation;
  }

  // Fallback to HuggingFace
  const prompt = buildPrompt(riskScore, flags, checks);
  let hfResult = await hfExplain(prompt);
  if (hfResult) {
    if (riskScore >= 80) return hfResult + ' 🇮🇳 अपना पैसा बचाएं! BLOCK करें!';
    else if (riskScore >= 50) return hfResult + ' 🇮🇳 चेतावनी! सावधानी से सोचें।';
    return hfResult + ' 🇮🇳 यह लेनदेन सुरक्षित है।';
  }

  // Final fallback
  return ruleBasedExplain(riskScore, flags, checks);
} */
// ai.js – AI Explanation Layer
// Uses Gemini 2.5 Flash SDK (Primary) with HuggingFace Inference API & Rule-based fallbacks

import { GoogleGenerativeAI } from "@google/generative-ai";

const HF_KEY = process.env.HF_KEY;
const GEMINI_KEY = process.env.GEMINI_KEY;

// Initialize Gemini SDK
const genAI = GEMINI_KEY ? new GoogleGenerativeAI(GEMINI_KEY) : null;

// ─── 1. Gemini "Deep Audit" (Structured JSON) ─────────────────────────────────
async function geminiDeepAudit(riskScore, checks, txPayload) {
  if (!genAI) return null;

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json", 
        temperature: 0.2, 
      }
    });

    const prompt = `
      You are ChainGuardian, an elite Smart Contract Security Auditor protecting Indian crypto beginners.
      Analyze this transaction payload and local heuristic data. Find vulnerabilities static analysis misses.

      Local Risk Score: ${riskScore}/100
      Transaction Data: ${JSON.stringify(txPayload || {})}
      Heuristics: ${JSON.stringify(checks || {})}

      Return ONLY a JSON object exactly in this structure:
      {
        "aiRiskScore": <number 0-100>,
        "maliciousIntentDetected": <boolean>,
        "logicalVulnerabilities": ["<vuln 1>", "<vuln 2>"],
        "humanTranslation": "<Translate the transaction data into simple English. E.g., 'You are approving Uniswap to spend your tokens.' Keep it under 12 words.>",
        "aiExplain": "<A short, punchy 2-sentence explanation of the specific risk. End each sentence with a period.>"
      }
    `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    return JSON.parse(responseText);
  } catch (e) {
    console.error("[ChainGuardian] Gemini SDK Error:", e.message);
    return null; 
  }
}

// ─── Build old system prompt for Fallbacks ────────────────────────────────────
function buildPrompt(riskScore, flags, checks) {
  const flagList = flags.join(', ') || 'No major flags';
  return `You are ChainGuardian, a DeFi security AI.
Risk Score: ${riskScore}/100. Flags: ${flagList}.
Whale: ${checks.whale || 0}%. Slither: ${checks.slither?.length || 0}. 
Unlimited approval: ${checks.unlimited ? 'YES' : 'NO'}. Drain: ${checks.drainDetected ? 'YES' : 'NO'}.
Write ONE sentence explaining the danger. End with a period.`;
}

// ─── 2. HuggingFace fallback ──────────────────────────────────────────────────
async function hfExplain(prompt) {
  if (!HF_KEY) return null;
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 6000);
    const resp = await fetch('https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${HF_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputs: `<s>[INST] ${prompt} [/INST]`, parameters: { max_new_tokens: 120, temperature: 0.3, return_full_text: false } }),
      signal: ctrl.signal
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const text = Array.isArray(data) ? data[0]?.generated_text : data?.generated_text;
    return text?.trim() || null;
  } catch {
    return null;
  }
}

// ─── 3. Rule-based fallback ───────────────────────────────────────────────────
function ruleBasedExplain(riskScore, flags, checks) {
  const parts = [];
  if (checks.drainDetected) parts.push('🚨 Simulation shows your tokens WILL be drained from this approval.');
  else if (checks.slither?.length > 0) parts.push(`🔴 Slither found ${checks.slither[0]} – a proven smart contract vulnerability.`);
  else if (checks.whale > 70) parts.push(`🐋 One wallet holds ${checks.whale}% of supply – classic rug pull setup.`);
  else if (checks.unlimited) parts.push('⚠️ Unlimited approval gives this contract access to ALL your tokens forever.');
  else if (checks.unverified) parts.push('❌ Contract source code is hidden – cannot verify what this contract does.');
  else parts.push(`⚠️ Risk score ${riskScore}% – multiple suspicious signals detected.`);

  if (riskScore >= 80) parts.push('🇮🇳 अपना पैसा बचाएं! यह लेनदेन खतरनाक है – BLOCK करें!');
  else if (riskScore >= 50) parts.push('🇮🇳 सावधान! यह contract संदिग्ध है।');
  else parts.push('🇮🇳 यह लेनदेन सुरक्षित है।');

  return parts.join(' ');
}

// ─── Main export ──────────────────────────────────────────────────────────────
export async function aiExplain(riskScore, flags, checks, txPayload = {}) {
  const geminiJson = await geminiDeepAudit(riskScore, checks, txPayload);

  if (geminiJson) {
    let finalExplanation = geminiJson.aiExplain;
    if (geminiJson.logicalVulnerabilities && geminiJson.logicalVulnerabilities.length > 0) {
      finalExplanation += ` Deep Audit detected: ${geminiJson.logicalVulnerabilities.join(', ')}.`;
    }
    if (geminiJson.aiRiskScore >= 80 || riskScore >= 80) finalExplanation += ' 🇮🇳 अपना पैसा बचाएं! यह लेनदेन खतरनाक है, BLOCK करें!';
    else if (geminiJson.aiRiskScore >= 50 || riskScore >= 50) finalExplanation += ' 🇮🇳 चेतावनी! सावधानी से सोचें।';
    else finalExplanation += ' 🇮🇳 यह लेनदेन सुरक्षित है। आप आगे बढ़ सकते हैं।';

    return {
      text: finalExplanation,
      translation: geminiJson.humanTranslation || "Unable to decode transaction intent."
    };
  }

  // Fallbacks
  const prompt = buildPrompt(riskScore, flags, checks);
  let hfResult = await hfExplain(prompt);
  let fallbackText = hfResult ? hfResult : ruleBasedExplain(riskScore, flags, checks);
  
  if (hfResult) {
    if (riskScore >= 80) fallbackText += ' 🇮🇳 अपना पैसा बचाएं! BLOCK करें!';
    else if (riskScore >= 50) fallbackText += ' 🇮🇳 चेतावनी! सावधानी से सोचें।';
    else fallbackText += ' 🇮🇳 यह लेनदेन सुरक्षित है।';
  }

  return {
    text: fallbackText,
    translation: "AI decoding offline. Relying on standard heuristics."
  };
}