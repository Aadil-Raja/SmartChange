import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import toast from 'react-hot-toast';
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyB-t_v2ogrvHuae0YDfdn_nlyC0_wpdbVc",
  authDomain: "smartchange-7e54c.firebaseapp.com",
  projectId: "smartchange-7e54c",
  storageBucket: "smartchange-7e54c.firebasestorage.app",
  messagingSenderId: "860919795899",
  appId: "1:860919795899:web:282a7cf3e0699c7cdb999e"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

/* ─────────────────────────────────────────
   STYLES — identical design system to Signup
───────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,600;0,9..144,700;0,9..144,800;0,9..144,900;1,9..144,300;1,9..144,400;1,9..144,600&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=DM+Mono:wght@300;400;500&display=swap');

  :root {
    --ink:       #0e0b07;
    --ink-2:     #1c1710;
    --ink-3:     #2e2619;
    --ink-4:     rgba(14,11,7,0.78);
    --ink-5:     rgba(14,11,7,0.52);
    --ink-6:     rgba(14,11,7,0.34);
    --ink-7:     rgba(14,11,7,0.16);
    --ink-8:     rgba(14,11,7,0.08);

    --parchment:   #f7f2e9;
    --parchment-2: #f0e9db;
    --parchment-3: #e8dece;
    --parchment-4: #d8ccb8;

    --canvas:  #faf6ef;
    --panel:   #f4ede2;

    --gold:    #e8922a;
    --gold-2:  #c97a18;
    --gold-3:  #f5aa55;
    --gold-dim:  rgba(232,146,42,0.13);
    --gold-glow: rgba(232,146,42,0.22);
    --gold-halo: rgba(232,146,42,0.07);
    --gold-line: rgba(232,146,42,0.4);

    --teal:     #1a8a7a;
    --teal-dim: rgba(26,138,122,0.11);
    --red:      #c0392b;
    --red-dim:  rgba(192,57,43,0.09);

    --font-display: 'Fraunces', Georgia, serif;
    --font-body:    'DM Sans', system-ui, sans-serif;
    --font-mono:    'DM Mono', monospace;

    --r-sm:  10px;
    --r-md:  16px;
    --r-lg:  22px;
    --r-xl:  30px;

    --shadow-xs: 0 1px 4px rgba(14,11,7,0.07);
    --shadow-sm: 0 2px 10px rgba(14,11,7,0.1), 0 1px 3px rgba(14,11,7,0.06);
    --shadow-md: 0 6px 24px rgba(14,11,7,0.13), 0 2px 8px rgba(14,11,7,0.07);
    --shadow-lg: 0 14px 44px rgba(14,11,7,0.17), 0 4px 14px rgba(14,11,7,0.08);
    --shadow-xl: 0 28px 72px rgba(14,11,7,0.22), 0 8px 28px rgba(14,11,7,0.1);

    --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
    --ease-out:    cubic-bezier(0.16, 1, 0.3, 1);
    --ease-smooth: cubic-bezier(0.4, 0, 0.2, 1);
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  ::selection { background: var(--gold-dim); color: var(--ink); }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-thumb { background: var(--parchment-3); border-radius: 99px; }

  /* ── Keyframes ── */
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(22px) scale(0.98); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes float {
    0%, 100% { transform: translateY(0px) rotate(0deg); }
    33%       { transform: translateY(-7px) rotate(1deg); }
    66%       { transform: translateY(-3px) rotate(-0.5deg); }
  }
  @keyframes logo-breathe {
    0%, 100% { box-shadow: 0 0 0 5px rgba(232,146,42,0.08), 0 0 28px rgba(232,146,42,0.12), var(--shadow-md); }
    50%       { box-shadow: 0 0 0 8px rgba(232,146,42,0.13), 0 0 48px rgba(232,146,42,0.20), var(--shadow-md); }
  }
  @keyframes orbit-1 {
    from { transform: rotate(0deg)   translateX(38px) rotate(0deg); }
    to   { transform: rotate(360deg) translateX(38px) rotate(-360deg); }
  }
  @keyframes orbit-2 {
    from { transform: rotate(0deg)    translateX(56px) rotate(0deg); }
    to   { transform: rotate(-360deg) translateX(56px) rotate(360deg); }
  }
  @keyframes pulse-ring {
    0%   { transform: scale(1);   opacity: 0.55; }
    100% { transform: scale(1.7); opacity: 0; }
  }
  @keyframes grain {
    0%,100% { transform: translate(0,0); }
    10%  { transform: translate(-2%,-3%); }
    25%  { transform: translate(3%,2%); }
    40%  { transform: translate(-1%,4%); }
    55%  { transform: translate(2%,-2%); }
    70%  { transform: translate(-3%,1%); }
    85%  { transform: translate(1%,3%); }
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes slide-down {
    from { opacity: 0; transform: translateY(-8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes error-shake {
    0%,100% { transform: translateX(0); }
    20%     { transform: translateX(-5px); }
    40%     { transform: translateX(5px); }
    60%     { transform: translateX(-3px); }
    80%     { transform: translateX(3px); }
  }
  @keyframes field-glow {
    0%,100% { border-color: rgba(232,146,42,0.45); box-shadow: 0 0 0 4px var(--gold-dim); }
    50%     { border-color: rgba(232,146,42,0.70); box-shadow: 0 0 0 5px rgba(232,146,42,0.10); }
  }
  @keyframes success-pop {
    0%   { opacity: 0; transform: scale(0.85); }
    60%  { transform: scale(1.06); }
    100% { opacity: 1; transform: scale(1); }
  }
  @keyframes check-draw {
    from { stroke-dashoffset: 40; }
    to   { stroke-dashoffset: 0; }
  }
  @keyframes shimmer-sweep {
    0%   { transform: translateX(-100%) skewX(-12deg); }
    100% { transform: translateX(300%)  skewX(-12deg); }
  }
  @keyframes step-slide-in {
    from { opacity: 0; transform: translateX(24px) scale(0.98); }
    to   { opacity: 1; transform: translateX(0) scale(1); }
  }
  @keyframes step-slide-out {
    from { opacity: 1; transform: translateX(0); }
    to   { opacity: 0; transform: translateX(-24px); }
  }

  /* ── Page root ── */
  .lg-page {
    min-height: 100vh; display: flex;
    background: var(--canvas);
    font-family: var(--font-body);
    position: relative; overflow: hidden;
  }

  /* ── Grain texture ── */
  .lg-grain {
    position: fixed; inset: 0; pointer-events: none; z-index: 999;
    opacity: 0.022;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    background-size: 200px 200px;
    animation: grain 0.45s steps(1) infinite;
    mix-blend-mode: multiply;
  }

  /* ── Background motif ── */
  .lg-bg { position: fixed; inset: 0; pointer-events: none; z-index: 0; overflow: hidden; }
  .lg-bg-r1 {
    position: absolute; top: -200px; right: -200px;
    width: 700px; height: 700px; border-radius: 50%;
    background: radial-gradient(circle, rgba(232,146,42,0.08) 0%, transparent 62%);
  }
  .lg-bg-r2 {
    position: absolute; bottom: -300px; left: -100px;
    width: 600px; height: 600px; border-radius: 50%;
    background: radial-gradient(circle, rgba(26,138,122,0.05) 0%, transparent 62%);
  }
  .lg-bg-grid {
    position: absolute; inset: 0; opacity: 0.016;
    background-image:
      linear-gradient(var(--ink) 1px, transparent 1px),
      linear-gradient(90deg, var(--ink) 1px, transparent 1px);
    background-size: 72px 72px;
  }

  /* ── Two-column layout ── */
  .lg-layout { display: flex; width: 100%; min-height: 100vh; position: relative; z-index: 1; }

  /* ── Left branding panel ── */
  .lg-left {
    flex: 1 1 0;
    min-width: 0;
    display: flex; flex-direction: column;
    justify-content: center; align-items: center;
    padding: 56px 40px;
    background:
      radial-gradient(circle at top, rgba(232,146,42,0.06), transparent 38%),
      linear-gradient(180deg, var(--parchment) 0%, #f6efe4 100%);
    border-right: 1px solid var(--parchment-3);
    position: relative; overflow: hidden;
  }
  .lg-left::after {
    content: '';
    position: absolute; top: 0; right: -1px; bottom: 0; width: 1px;
    background: linear-gradient(180deg, transparent 0%, var(--gold-line) 30%, var(--gold-line) 70%, transparent 100%);
  }
  .lg-left-r1 {
    position: absolute; top: -120px; right: -120px;
    width: 380px; height: 380px; border-radius: 50%; pointer-events: none;
    background: radial-gradient(circle, rgba(232,146,42,0.09) 0%, transparent 65%);
  }
  .lg-left-r2 {
    position: absolute; bottom: -80px; left: -80px;
    width: 300px; height: 300px; border-radius: 50%; pointer-events: none;
    background: radial-gradient(circle, rgba(26,138,122,0.06) 0%, transparent 65%);
  }

  .lg-left-inner {
    width: 100%; max-width: 430px; position: relative; z-index: 1;
    display: flex; flex-direction: column; align-items: center; text-align: center;
  }

  /* Logo hero */
  .lg-logo-wrap { position: relative; margin-bottom: 36px; animation: float 5s ease-in-out infinite; }
  .lg-logo-orb {
    width: 88px; height: 88px; border-radius: 28px; background: var(--ink);
    display: flex; align-items: center; justify-content: center; position: relative;
    animation: logo-breathe 4s ease-in-out infinite;
  }
  .lg-logo-orb::before {
    content: ''; position: absolute; inset: -16px; border-radius: 40px;
    border: 1px dashed rgba(232,146,42,0.24);
  }
  .lg-logo-orb::after {
    content: ''; position: absolute; inset: -30px; border-radius: 56px;
    border: 1px dashed rgba(232,146,42,0.11);
  }
  .lg-orbit-1 {
    position: absolute; width: 9px; height: 9px; border-radius: 50%;
    background: var(--gold); box-shadow: 0 0 10px rgba(232,146,42,0.7);
    animation: orbit-1 8s linear infinite;
    top: 50%; left: 50%; margin: -4.5px;
  }
  .lg-orbit-2 {
    position: absolute; width: 6px; height: 6px; border-radius: 50%;
    background: var(--teal); opacity: 0.7;
    animation: orbit-2 13s linear infinite;
    top: 50%; left: 50%; margin: -3px;
  }
  .lg-pulse {
    position: absolute; inset: -5px; border-radius: 32px;
    border: 1.5px solid rgba(232,146,42,0.4);
    animation: pulse-ring 3.5s ease-out infinite;
  }

  /* Left text */
  .lg-eyebrow {
    font-family: var(--font-mono); font-size: 10px; font-weight: 500;
    color: var(--gold-2); letter-spacing: 0.18em; text-transform: uppercase;
    margin-bottom: 16px; display: flex; align-items: center; justify-content: center; gap: 10px;
    animation: fadeUp 0.5s var(--ease-out) 0.1s both;
  }
  .lg-eyebrow::before, .lg-eyebrow::after {
    content: ''; display: block; width: 28px; height: 1px; background: var(--gold-3); opacity: 0.55;
  }
  .lg-brand-title {
    font-family: var(--font-display); font-size: 48px; font-weight: 800;
    color: var(--ink); letter-spacing: -0.04em; line-height: 1.05;
    margin-bottom: 16px; animation: fadeUp 0.55s var(--ease-out) 0.15s both;
  }
  .lg-brand-title em { font-style: italic; font-weight: 300; color: var(--ink-5); }
  .lg-brand-sub {
    font-family: var(--font-display); font-style: italic;
    font-size: 16px; color: var(--ink-5); line-height: 1.65;
    margin-bottom: 36px; max-width: 340px;
    animation: fadeUp 0.55s var(--ease-out) 0.22s both;
  }

  /* Feature items */
  .lg-features { display: flex; flex-direction: column; gap: 12px; width: 100%; animation: fadeUp 0.55s var(--ease-out) 0.3s both; }
  .lg-feat { display: flex; align-items: center; gap: 12px; justify-content: center; }
  .lg-feat-dot {
    width: 28px; height: 28px; border-radius: 9px; flex-shrink: 0;
    background: var(--gold-dim); border: 1px solid rgba(232,146,42,0.25);
    display: flex; align-items: center; justify-content: center;
  }
  .lg-feat-text { font-size: 13px; color: var(--ink-5); font-family: var(--font-body); font-weight: 500; max-width: 280px; }

  .lg-left-foot {
    position: absolute; bottom: 32px; left: 50%; transform: translateX(-50%);
    font-size: 10px; color: var(--ink-6); font-family: var(--font-mono); letter-spacing: 0.08em;
    white-space: nowrap;
  }

  /* ── Right form panel ── */
  .lg-right {
    flex: 1 1 0; min-width: 0;
    display: flex; flex-direction: column;
    justify-content: center; align-items: center;
    padding: 56px 40px; overflow-y: auto;
    background: linear-gradient(180deg, rgba(250,246,239,0.96) 0%, rgba(248,243,235,0.98) 100%);
  }
  .lg-card {
    width: 100%; max-width: 520px; animation: fadeUp 0.6s var(--ease-out) 0.05s both;
    padding: 40px 38px;
    background: rgba(255,255,255,0.72);
    border: 1px solid rgba(232,146,42,0.12);
    border-radius: 30px;
    box-shadow: var(--shadow-xl);
    backdrop-filter: blur(14px);
  }

  /* Form header */
  .lg-form-head { margin-bottom: 30px; animation: fadeUp 0.5s var(--ease-out) 0.12s both; }
  .lg-form-eyebrow {
    font-family: var(--font-mono); font-size: 10px; font-weight: 500;
    color: var(--gold-2); letter-spacing: 0.15em; text-transform: uppercase; margin-bottom: 10px;
  }
  .lg-form-title {
    font-family: var(--font-display); font-size: 36px; font-weight: 800;
    color: var(--ink); letter-spacing: -0.04em; line-height: 1.05; margin-bottom: 8px;
  }
  .lg-form-sub { font-size: 15px; color: var(--ink-5); font-family: var(--font-body); }
  .lg-title-rule {
    width: 48px; height: 2px; border-radius: 2px; margin-top: 14px;
    background: linear-gradient(90deg, var(--gold), var(--gold-3));
  }

  /* ── Step panel ── */
  .lg-step { animation: step-slide-in 0.3s var(--ease-out); }

  /* ── Fields ── */
  .lg-fields { display: flex; flex-direction: column; gap: 20px; }
  .lg-field {
    display: flex; flex-direction: column; gap: 7px;
    animation: fadeUp 0.45s var(--ease-out) both;
  }
  .lg-field:nth-child(1) { animation-delay: 0.14s; }
  .lg-field:nth-child(2) { animation-delay: 0.2s; }
  .lg-label {
    font-size: 12.5px; font-weight: 600; color: var(--ink-4);
    font-family: var(--font-body); letter-spacing: 0.01em;
  }
  .lg-input-wrap { position: relative; }
  .lg-input {
    width: 100%; padding: 15px 18px 15px 46px;
    background: rgba(247,242,233,0.85); border: 1.5px solid var(--parchment-3);
    border-radius: var(--r-md); color: var(--ink);
    font-family: var(--font-body); font-size: 15px; outline: none;
    transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
    box-shadow: var(--shadow-xs);
  }
  .lg-input::placeholder { color: var(--ink-6); }
  .lg-input:focus { background: var(--canvas); animation: field-glow 3s ease-in-out infinite; }
  .lg-input:focus + .lg-icon { color: var(--gold-2); }
  .lg-input.no-icon { padding-left: 18px; }
  .lg-input.has-toggle { padding-right: 46px; }
  .lg-icon {
    position: absolute; left: 15px; top: 50%; transform: translateY(-50%);
    color: var(--ink-6); pointer-events: none; transition: color 0.2s;
  }
  .lg-pw-toggle {
    position: absolute; right: 14px; top: 50%; transform: translateY(-50%);
    background: none; border: none; cursor: pointer; padding: 4px;
    color: var(--ink-6); border-radius: 6px; transition: all 0.15s;
    display: flex; align-items: center; justify-content: center;
  }
  .lg-pw-toggle:hover { color: var(--ink-4); background: var(--parchment-2); }

  /* ── Alert ── */
  .lg-alert {
    padding: 13px 16px; border-radius: var(--r-md);
    font-size: 13px; font-family: var(--font-body); font-weight: 500;
    display: flex; align-items: flex-start; gap: 10px;
    margin-bottom: 24px;
  }
  .lg-alert.error {
    background: var(--red-dim); color: var(--red);
    border: 1px solid rgba(192,57,43,0.2);
    animation: slide-down 0.25s var(--ease-out), error-shake 0.4s ease 0.25s;
  }
  .lg-alert.success {
    background: var(--teal-dim); color: var(--teal);
    border: 1px solid rgba(26,138,122,0.22);
    animation: slide-down 0.25s var(--ease-out);
  }
  .lg-alert-icon { flex-shrink: 0; margin-top: 1px; }

  /* ── Primary submit button ── */
  .lg-submit {
    width: 100%; padding: 16px 24px; margin-top: 8px;
    background: var(--ink); color: var(--parchment);
    border: none; border-radius: var(--r-md); cursor: pointer;
    font-family: var(--font-body); font-size: 15px; font-weight: 600;
    letter-spacing: 0.01em; box-shadow: var(--shadow-sm);
    transition: all 0.22s var(--ease-out);
    position: relative; overflow: hidden;
    display: flex; align-items: center; justify-content: center; gap: 10px;
    animation: fadeUp 0.5s var(--ease-out) 0.28s both;
  }
  .lg-submit::before {
    content: ''; position: absolute; top: 0; left: -80%; width: 50%; height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent);
    transition: left 0.55s ease;
  }
  .lg-submit:hover:not(:disabled) { background: var(--ink-3); transform: translateY(-2px); box-shadow: var(--shadow-lg); }
  .lg-submit:hover:not(:disabled)::before { left: 140%; }
  .lg-submit:active:not(:disabled) { transform: translateY(0) scale(0.99); }
  .lg-submit:disabled { background: var(--parchment-3); color: var(--ink-6); cursor: not-allowed; box-shadow: none; }
  .lg-spinner {
    width: 17px; height: 17px; border-radius: 50%;
    border: 2px solid rgba(247,242,233,0.3); border-top-color: var(--parchment);
    animation: spin 0.8s linear infinite; flex-shrink: 0;
  }

  /* ── Links ── */
  .lg-link {
    font-weight: 600; color: var(--gold-2);
    text-decoration: none; letter-spacing: 0.01em;
    transition: all 0.16s; position: relative; padding-bottom: 1px;
  }
  .lg-link::after {
    content: ''; position: absolute; bottom: 0; left: 0; width: 0; height: 1.5px;
    background: var(--gold-2); transition: width 0.25s var(--ease-out); border-radius: 2px;
  }
  .lg-link:hover { color: var(--gold); }
  .lg-link:hover::after { width: 100%; }

  /* ── Divider ── */
  .lg-divider {
    display: flex; align-items: center; gap: 14px; margin: 24px 0;
  }
  .lg-divider-line { flex: 1; height: 1px; background: var(--parchment-3); }
  .lg-divider-text {
    font-size: 10.5px; color: var(--ink-6); font-family: var(--font-mono);
    letter-spacing: 0.08em; white-space: nowrap;
  }

  /* ── Google button ── */
  .lg-google {
    width: 100%; padding: 14px 24px;
    background: var(--parchment); border: 1.5px solid var(--parchment-3);
    border-radius: var(--r-md); cursor: pointer;
    font-family: var(--font-body); font-size: 14px; font-weight: 600;
    color: var(--ink-4); letter-spacing: 0.01em;
    display: flex; align-items: center; justify-content: center; gap: 12px;
    transition: all 0.2s var(--ease-out); box-shadow: var(--shadow-xs);
    position: relative; overflow: hidden;
  }
  .lg-google::before {
    content: ''; position: absolute; top: 0; left: -80%; width: 50%; height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
    transition: left 0.5s ease;
  }
  .lg-google:hover { border-color: var(--parchment-4); color: var(--ink); background: var(--parchment-2); box-shadow: var(--shadow-sm); transform: translateY(-1px); }
  .lg-google:hover::before { left: 140%; }
  .lg-google:active { transform: translateY(0); }
  .lg-google:disabled { opacity: 0.5; cursor: not-allowed; }

  /* ── Forgot password ── */
  .lg-forgot {
    display: flex; justify-content: flex-end; margin-top: -8px;
  }
  .lg-forgot-link {
    font-family: var(--font-mono); font-size: 11px; font-weight: 500;
    color: var(--ink-6); letter-spacing: 0.04em;
    text-decoration: none; transition: color 0.16s;
  }
  .lg-forgot-link:hover { color: var(--gold-2); }

  /* ── Footer ── */
  .lg-footer {
    text-align: center; margin-top: 28px;
    animation: fadeUp 0.5s var(--ease-out) 0.38s both;
  }
  .lg-footer-text { font-size: 14px; color: var(--ink-5); font-family: var(--font-body); }

  /* ── Verified success screen ── */
  .lg-verified {
    display: flex; flex-direction: column; align-items: center;
    text-align: center; gap: 20px; padding: 20px 0;
    animation: success-pop 0.5s var(--ease-spring);
  }
  .lg-verified-ring {
    width: 80px; height: 80px; border-radius: 50%;
    background: var(--teal-dim); border: 2px solid rgba(26,138,122,0.3);
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 0 0 8px rgba(26,138,122,0.07);
  }
  .lg-verified-title {
    font-family: var(--font-display); font-size: 24px; font-weight: 700;
    color: var(--teal); letter-spacing: -0.02em;
  }
  .lg-verified-sub { font-size: 14px; color: var(--ink-5); font-family: var(--font-mono); letter-spacing: 0.04em; }

  /* ── Code step ── */
  .lg-code-input {
    width: 100%; padding: 16px 18px; text-align: center;
    background: var(--parchment); border: 1.5px solid var(--parchment-3);
    border-radius: var(--r-md); color: var(--ink);
    font-family: var(--font-mono); font-size: 24px; font-weight: 500;
    letter-spacing: 0.3em; outline: none;
    transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
    box-shadow: var(--shadow-xs);
  }
  .lg-code-input:focus { background: var(--canvas); animation: field-glow 3s ease-in-out infinite; }
  .lg-code-input::placeholder { color: var(--ink-7); font-size: 18px; letter-spacing: 0.2em; }

  /* Resend row */
  .lg-resend-row {
    display: flex; align-items: center; justify-content: center; gap: 6px;
    margin-top: 16px; font-size: 13px; color: var(--ink-5); font-family: var(--font-body);
  }
  .lg-resend-btn {
    background: none; border: none; cursor: pointer;
    font-family: var(--font-body); font-size: 13px; font-weight: 600;
    color: var(--gold-2); padding: 0; transition: color 0.15s;
  }
  .lg-resend-btn:hover { color: var(--gold); }

  /* Code back link */
  .lg-back-btn {
    display: inline-flex; align-items: center; gap: 6px;
    background: none; border: none; cursor: pointer;
    font-family: var(--font-mono); font-size: 11px; font-weight: 500;
    color: var(--ink-6); letter-spacing: 0.04em;
    padding: 0; margin-bottom: 24px; transition: color 0.15s;
  }
  .lg-back-btn:hover { color: var(--ink-4); }

  /* ── Mobile ── */
  @media (max-width: 768px) {
    .lg-left { display: none; }
    .lg-right { padding: 24px 16px; }
    .lg-card { max-width: 440px; padding: 30px 22px; border-radius: 24px; }
  }
`;

/* ── Icons ── */
const IconMail = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="1.5" y="3.5" width="13" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M1.5 5.5l6.5 4 6.5-4" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
  </svg>
);
const IconLock = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="3" y="7" width="10" height="7.5" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M5 7V5a3 3 0 016 0v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="8" cy="10.5" r="1" fill="currentColor"/>
  </svg>
);
const IconKey = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <circle cx="5.5" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M8.5 8h6M12.5 8v2.5M14.5 8v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);
const IconEye = ({ off }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    {off ? (
      <>
        <path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" stroke="currentColor" strokeWidth="1.4"/>
        <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.4"/>
        <path d="M2 2l12 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      </>
    ) : (
      <>
        <path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" stroke="currentColor" strokeWidth="1.4"/>
        <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.4"/>
      </>
    )}
  </svg>
);
const IconAlert = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
    <circle cx="7.5" cy="7.5" r="6.5" stroke="currentColor" strokeWidth="1.4"/>
    <path d="M7.5 4.5v4M7.5 10.5v.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
  </svg>
);
const IconCheck = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
    <circle cx="7.5" cy="7.5" r="6.5" stroke="currentColor" strokeWidth="1.4"/>
    <path d="M4.5 7.5l2 2 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconCheckBig = () => (
  <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
    <path
      d="M7 18l8 8L29 10"
      stroke="var(--teal)" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"
      style={{ strokeDasharray: 40, strokeDashoffset: 40, animation: 'check-draw 0.5s ease 0.1s forwards' }}
    />
  </svg>
);
const IconArrowLeft = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <path d="M8 2L4 6l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconGoogle = () => (
  <svg width="18" height="18" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

const Login = () => {
  const navigate = useNavigate();
  const { login, verifyCode, requestCode, loginWithGoogle, loading } = useAuth();
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [code, setCode]                 = useState('');
  const [step, setStep]                 = useState('password');
  const [message, setMessage]           = useState('');
  const [showPw, setShowPw]             = useState(false);

  const isSuccess = message && message.includes('successful');

  /* ── Handlers (identical to original) ── */
  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    setMessage('');
    if (!email || !email.includes('@')) { const m = 'Please enter a valid email address'; setMessage(m); toast.error(m); return; }
    if (!password) { const m = 'Please enter your password'; setMessage(m); toast.error(m); return; }
    try {
      const result = await login(email, password);
      if (result.success) {
        toast.success('Login successful! Redirecting...');
        setMessage('Login successful! Redirecting...');
        setTimeout(() => { window.location.href = '/employee/myteams'; }, 1000);
        return;
      }
      const msg = result.message?.toLowerCase() || '';
      if (msg.includes('unverified') || msg.includes('verify your email') || msg.includes('verification code') || msg.includes('otp') || msg.includes('please verify your email to continue')) {
        navigate('/verify-code', { state: { email } });
        return;
      }
      const m = result.message || 'Invalid email or password';
      setMessage(m);
      toast.error(m);
    } catch (error) {
      const m = 'Something went wrong. Please try again.';
      setMessage(m);
      toast.error(m);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setMessage('');
      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken(true);
      const response = await loginWithGoogle(idToken);
      if (response.success) {
        setStep('verified');
        toast.success('Login successful! Redirecting...');
        setMessage('Login successful! Redirecting...');
        setTimeout(() => { window.location.href = '/employee/myteams'; }, 1000);
      } else {
        const m = response.message || 'Google login failed';
        setMessage(m);
        toast.error(m);
      }
    } catch (err) {
      const m = err.response?.data?.message || 'Failed to sign in with Google';
      setMessage(m);
      toast.error(m);
    }
  };

  const handleRequestCode = async () => {
    const result = await requestCode(email);
    const m = result.message || (result.success ? 'Code resent' : 'Failed to resend');
    setMessage(m);
    result.success ? toast.success(m) : toast.error(m);
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setMessage('');
    const result = await verifyCode(email, code);
    if (result.success) {
      setStep('verified');
      toast.success('Login successful! Redirecting...');
      setMessage('Login successful! Redirecting...');
      setTimeout(() => { window.location.href = '/employee/myteams'; }, 1000);
    } else {
      const m = result.message || 'Invalid code';
      setMessage(m);
      toast.error(m);
    }
  };

  /* ── Step metadata ── */
  const stepMeta = {
    password:         { eyebrow: 'Welcome back', title: 'Sign in',           sub: 'Continue to your workspace' },
    'code-requested': { eyebrow: 'Verification',  title: 'Enter your code',   sub: `We sent a 6-digit code to ${email}` },
    verified:         { eyebrow: '',              title: '',                  sub: '' },
  };
  const meta = stepMeta[step] || stepMeta.password;

  return (
    <>
      <style>{STYLES}</style>

      <div className="lg-page">
        <div className="lg-grain" />

        {/* Background */}
        <div className="lg-bg">
          <div className="lg-bg-r1" />
          <div className="lg-bg-r2" />
          <div className="lg-bg-grid" />
          <svg style={{ position: 'absolute', bottom: 0, right: 0, opacity: 0.025 }} width="440" height="440" viewBox="0 0 440 440">
            {[0, 80, 160, 240, 320].map(o => <line key={o} x1={440} y1={o} x2={o} y2={440} stroke="#0e0b07" strokeWidth="1"/>)}
          </svg>
        </div>

        <div className="lg-layout">

          {/* ── Left panel ── */}
          <div className="lg-left">
            <div className="lg-left-r1" />
            <div className="lg-left-r2" />

            <div className="lg-left-inner">
              <div className="lg-logo-wrap">
                <div className="lg-logo-orb">
                  <div className="lg-pulse" />
                  <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
                    <circle cx="22" cy="22" r="22" fill="rgba(232,146,42,0.08)"/>
                    <path d="M22 10a12 12 0 100 24 12 12 0 000-24zm0 4.8c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 16.8c-2.67 0-5.04-1.36-6.44-3.44.05-2.13 4.3-3.31 6.44-3.31 2.14 0 6.39 1.18 6.44 3.31A7.52 7.52 0 0122 31.6z" fill="var(--gold)"/>
                  </svg>
                  <span className="lg-orbit-1" />
                  <span className="lg-orbit-2" />
                </div>
              </div>

              <div className="lg-eyebrow">KE Smart Change</div>
              <h2 className="lg-brand-title">Welcome<br /><em>back</em></h2>
              <p className="lg-brand-sub">
                Pick up where you left off. Your team and insights are waiting.
              </p>

              <div className="lg-features">
                {[
                  { icon: '◆', text: 'AI-powered insights & recommendations' },
                  { icon: '◈', text: 'Real-time collaboration tools' },
                  { icon: '✦', text: 'Cited, grounded decision support' },
                ].map(({ icon, text }) => (
                  <div key={text} className="lg-feat">
                    <div className="lg-feat-dot">
                      <span style={{ fontSize: 11, color: 'var(--gold-2)' }}>{icon}</span>
                    </div>
                    <span className="lg-feat-text">{text}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="lg-left-foot">© {new Date().getFullYear()} KE Smart Change · Secure & encrypted</div>
          </div>

          {/* ── Right form panel ── */}
          <div className="lg-right">
            <div className="lg-card">

              {/* ── VERIFIED state ── */}
              {step === 'verified' ? (
                <>
                  <div className="lg-verified">
                    <div className="lg-verified-ring">
                      <IconCheckBig />
                    </div>
                    <div>
                      <div className="lg-verified-title">You're in!</div>
                      <div className="lg-verified-sub" style={{ marginTop: 6 }}>Redirecting to your workspace…</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                      <span style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(26,138,122,0.3)', borderTopColor: 'var(--teal)', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
                      <span style={{ fontSize: 12, color: 'var(--ink-6)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>Loading workspace</span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Form header */}
                  <div className="lg-form-head">
                    <div className="lg-form-eyebrow">{meta.eyebrow}</div>
                    <h1 className="lg-form-title">{meta.title}</h1>
                    <p className="lg-form-sub">{meta.sub}</p>
                    <div className="lg-title-rule" />
                  </div>

                  {/* Alert */}
                  {message && (
                    <div className={`lg-alert ${isSuccess ? 'success' : 'error'}`}>
                      <span className="lg-alert-icon">{isSuccess ? <IconCheck /> : <IconAlert />}</span>
                      {message}
                    </div>
                  )}

                  {/* ── PASSWORD STEP ── */}
                  {step === 'password' && (
                    <div className="lg-step" key="step-pw">
                      <form onSubmit={handlePasswordLogin}>
                        <div className="lg-fields">

                          {/* Email */}
                          <div className="lg-field">
                            <label className="lg-label" htmlFor="email">Email address</label>
                            <div className="lg-input-wrap">
                              <input
                                id="email" type="email" required
                                className="lg-input"
                                placeholder="Enter your email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                              />
                              <span className="lg-icon"><IconMail /></span>
                            </div>
                          </div>

                          {/* Password */}
                          <div className="lg-field">
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <label className="lg-label" htmlFor="password">Password</label>
                              <a href="/forgot-password" className="lg-forgot-link">Forgot password?</a>
                            </div>
                            <div className="lg-input-wrap">
                              <input
                                id="password" type={showPw ? 'text' : 'password'} required
                                className="lg-input has-toggle"
                                placeholder="Enter your password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                              />
                              <span className="lg-icon"><IconLock /></span>
                              <button type="button" className="lg-pw-toggle" onClick={() => setShowPw(v => !v)}>
                                <IconEye off={showPw} />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Submit */}
                        <button type="submit" className="lg-submit" disabled={loading}>
                          {loading ? (
                            <><span className="lg-spinner" />Signing in…</>
                          ) : (
                            <>
                              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                                <path d="M13 7.5L8 3M13 7.5L8 12M13 7.5H2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                              Sign in
                            </>
                          )}
                        </button>
                      </form>

                      {/* Divider */}
                      <div className="lg-divider">
                        <div className="lg-divider-line" />
                        <span className="lg-divider-text">or continue with</span>
                        <div className="lg-divider-line" />
                      </div>

                      {/* Google */}
                      <button className="lg-google" onClick={handleGoogleLogin} disabled={loading}>
                        <IconGoogle />
                        Sign in with Google
                      </button>

                      {/* Sign up link */}
                      <div className="lg-footer">
                        <span className="lg-footer-text">Don't have an account? </span>
                        <a href="/signup" className="lg-link">Create one</a>
                      </div>
                    </div>
                  )}

                  {/* ── CODE STEP ── */}
                  {step === 'code-requested' && (
                    <div className="lg-step" key="step-code">
                      {/* Back button */}
                      <button className="lg-back-btn" onClick={() => { setStep('password'); setMessage(''); setCode(''); }}>
                        <IconArrowLeft /> Back to sign in
                      </button>

                      {/* Code display hint */}
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
                        borderRadius: 'var(--r-md)', background: 'var(--gold-halo)',
                        border: '1px solid rgba(232,146,42,0.2)', marginBottom: 24,
                      }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: 11, flexShrink: 0,
                          background: 'var(--gold-dim)', border: '1px solid rgba(232,146,42,0.28)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <IconKey />
                        </div>
                        <div>
                          <p style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', fontFamily: 'var(--font-body)', marginBottom: 2 }}>Check your inbox</p>
                          <p style={{ fontSize: 11.5, color: 'var(--ink-5)', fontFamily: 'var(--font-mono)', letterSpacing: '0.02em' }}>{email}</p>
                        </div>
                      </div>

                      <form onSubmit={handleVerifyCode}>
                        <div className="lg-field" style={{ marginBottom: 24 }}>
                          <label className="lg-label" htmlFor="code" style={{ textAlign: 'center', display: 'block' }}>6-digit verification code</label>
                          <input
                            id="code" type="text" inputMode="numeric"
                            className="lg-code-input"
                            placeholder="· · · · · ·"
                            maxLength={6}
                            value={code}
                            onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                          />
                        </div>

                        <button type="submit" className="lg-submit" disabled={loading || code.length < 6}>
                          {loading ? (
                            <><span className="lg-spinner" />Verifying…</>
                          ) : (
                            <>
                              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                                <path d="M1.5 7.5l4 4 8-8" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                              Verify &amp; sign in
                            </>
                          )}
                        </button>
                      </form>

                      <div className="lg-resend-row">
                        <span>Didn't receive it?</span>
                        <button className="lg-resend-btn" onClick={handleRequestCode}>Resend code</button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Login;