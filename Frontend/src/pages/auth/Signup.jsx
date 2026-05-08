import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import toast from 'react-hot-toast';

/* ─── All styles inline — matches RAGChatbot design system exactly ─── */
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

    --canvas:    #faf6ef;
    --panel:     #f4ede2;

    --gold:      #e8922a;
    --gold-2:    #c97a18;
    --gold-3:    #f5aa55;
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
    from { opacity: 0; transform: translateY(24px) scale(0.98); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes fadeIn {
    from { opacity: 0; } to { opacity: 1; }
  }
  @keyframes float {
    0%, 100% { transform: translateY(0px) rotate(0deg); }
    33%       { transform: translateY(-7px) rotate(1deg); }
    66%       { transform: translateY(-3px) rotate(-0.5deg); }
  }
  @keyframes logo-breathe {
    0%, 100% { box-shadow: 0 0 0 5px rgba(232,146,42,0.08), 0 0 28px rgba(232,146,42,0.12), var(--shadow-md); }
    50%       { box-shadow: 0 0 0 8px rgba(232,146,42,0.13), 0 0 48px rgba(232,146,42,0.2),  var(--shadow-md); }
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
    0%   { transform: scale(1); opacity: 0.55; }
    100% { transform: scale(1.7); opacity: 0; }
  }
  @keyframes grain {
    0%, 100% { transform: translate(0,0); }
    10%  { transform: translate(-2%,-3%); }
    25%  { transform: translate(3%,2%); }
    40%  { transform: translate(-1%,4%); }
    55%  { transform: translate(2%,-2%); }
    70%  { transform: translate(-3%,1%); }
    85%  { transform: translate(1%,3%); }
  }
  @keyframes shimmer-sweep {
    0%   { transform: translateX(-100%) skewX(-12deg); }
    100% { transform: translateX(300%)  skewX(-12deg); }
  }
  @keyframes field-glow {
    0%, 100% { border-color: rgba(232,146,42,0.45); box-shadow: 0 0 0 4px var(--gold-dim); }
    50%       { border-color: rgba(232,146,42,0.7);  box-shadow: 0 0 0 5px rgba(232,146,42,0.1); }
  }
  @keyframes error-shake {
    0%, 100% { transform: translateX(0); }
    20%       { transform: translateX(-5px); }
    40%       { transform: translateX(5px); }
    60%       { transform: translateX(-3px); }
    80%       { transform: translateX(3px); }
  }
  @keyframes check-draw {
    from { stroke-dashoffset: 24; }
    to   { stroke-dashoffset: 0; }
  }
  @keyframes strength-fill {
    from { width: 0; }
    to   { width: var(--target-w); }
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  @keyframes slide-down {
    from { opacity: 0; transform: translateY(-6px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* ── Page root ── */
  .su-page {
    min-height: 100vh; display: flex;
    background: var(--canvas);
    font-family: var(--font-body);
    position: relative; overflow: hidden;
  }

  /* ── Grain texture ── */
  .su-grain {
    position: fixed; inset: 0; pointer-events: none; z-index: 999;
    opacity: 0.022;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    background-size: 200px 200px;
    animation: grain 0.45s steps(1) infinite;
    mix-blend-mode: multiply;
  }

  /* ── Background motif ── */
  .su-bg { position: fixed; inset: 0; pointer-events: none; z-index: 0; overflow: hidden; }
  .su-bg-radial-1 {
    position: absolute; top: -200px; right: -200px;
    width: 700px; height: 700px; border-radius: 50%;
    background: radial-gradient(circle, rgba(232,146,42,0.08) 0%, transparent 62%);
  }
  .su-bg-radial-2 {
    position: absolute; bottom: -300px; left: -100px;
    width: 600px; height: 600px; border-radius: 50%;
    background: radial-gradient(circle, rgba(26,138,122,0.05) 0%, transparent 62%);
  }
  .su-bg-grid {
    position: absolute; inset: 0; opacity: 0.016;
    background-image:
      linear-gradient(var(--ink) 1px, transparent 1px),
      linear-gradient(90deg, var(--ink) 1px, transparent 1px);
    background-size: 72px 72px;
  }
  .su-bg-diag {
    position: absolute; bottom: 0; right: 0; opacity: 0.025;
  }

  /* ── Two-column layout ── */
  .su-layout {
    display: flex; width: 100%; min-height: 100vh;
    position: relative; z-index: 1;
  }

  /* ── Left panel (form) ── */
  .su-left {
    flex: 1 1 0; min-width: 0;
    display: flex; flex-direction: column;
    justify-content: center; align-items: center;
    padding: 56px 40px;
    background: linear-gradient(180deg, rgba(250,246,239,0.98) 0%, rgba(247,242,233,0.94) 100%);
    border-right: 1px solid var(--parchment-3);
    position: relative; overflow: hidden;
  }
  .su-left::after {
    content: '';
    position: absolute; top: 0; right: -1px; bottom: 0; width: 1px;
    background: linear-gradient(180deg, transparent 0%, var(--gold-line) 30%, var(--gold-line) 70%, transparent 100%);
  }
  /* Warm radial inside left panel */
  .su-left-radial {
    position: absolute; top: -120px; right: -120px;
    width: 380px; height: 380px; border-radius: 50%; pointer-events: none;
    background: radial-gradient(circle, rgba(232,146,42,0.09) 0%, transparent 65%);
  }
  .su-left-bottom {
    position: absolute; bottom: -80px; left: -80px;
    width: 300px; height: 300px; border-radius: 50%; pointer-events: none;
    background: radial-gradient(circle, rgba(26,138,122,0.06) 0%, transparent 65%);
  }

  .su-form-inner {
    width: 100%; max-width: 520px; position: relative; z-index: 1;
  }

  /* Logo hero */
  .su-logo-wrap {
    position: relative; margin-bottom: 48px;
    animation: float 5s ease-in-out infinite;
  }
  .su-logo-orb {
    width: 88px; height: 88px; border-radius: 28px;
    background: var(--ink);
    display: flex; align-items: center; justify-content: center;
    position: relative;
    animation: logo-breathe 4s ease-in-out infinite;
  }
  .su-logo-orb::before {
    content: ''; position: absolute; inset: -16px; border-radius: 40px;
    border: 1px dashed rgba(232,146,42,0.24);
  }
  .su-logo-orb::after {
    content: ''; position: absolute; inset: -30px; border-radius: 56px;
    border: 1px dashed rgba(232,146,42,0.11);
  }
  .su-orbit-dot-1 {
    position: absolute; width: 9px; height: 9px; border-radius: 50%;
    background: var(--gold); box-shadow: 0 0 10px rgba(232,146,42,0.7);
    animation: orbit-1 8s linear infinite;
    top: 50%; left: 50%; margin: -4.5px;
  }
  .su-orbit-dot-2 {
    position: absolute; width: 6px; height: 6px; border-radius: 50%;
    background: var(--teal); opacity: 0.7;
    animation: orbit-2 13s linear infinite;
    top: 50%; left: 50%; margin: -3px;
  }
  .su-pulse-ring {
    position: absolute; inset: -5px; border-radius: 32px;
    border: 1.5px solid rgba(232,146,42,0.4);
    animation: pulse-ring 3.5s ease-out infinite;
  }

  /* Left text */
  .su-eyebrow {
    font-family: var(--font-mono); font-size: 10px; font-weight: 500;
    color: var(--gold-2); letter-spacing: 0.18em; text-transform: uppercase;
    margin-bottom: 16px; display: flex; align-items: center; gap: 10px;
    animation: fadeUp 0.5s var(--ease-out) 0.1s both;
  }
  .su-eyebrow::before, .su-eyebrow::after {
    content: ''; display: block; width: 28px; height: 1px; background: var(--gold-3); opacity: 0.55;
  }
  .su-brand-title {
    font-family: var(--font-display); font-size: 42px; font-weight: 800;
    color: var(--ink); letter-spacing: -0.04em; line-height: 1.05;
    margin-bottom: 16px;
    animation: fadeUp 0.55s var(--ease-out) 0.15s both;
  }
  .su-brand-title em { font-style: italic; font-weight: 300; color: var(--ink-5); }

  .su-brand-sub {
    font-family: var(--font-display); font-style: italic;
    font-size: 16px; color: var(--ink-5); line-height: 1.65;
    margin-bottom: 48px; max-width: 280px;
    animation: fadeUp 0.55s var(--ease-out) 0.22s both;
  }

  /* Feature chips */
  .su-features {
    display: flex; flex-direction: column; gap: 12px;
    animation: fadeUp 0.55s var(--ease-out) 0.3s both;
  }
  .su-feature-item {
    display: flex; align-items: center; gap: 12px;
  }
  .su-feature-dot {
    width: 28px; height: 28px; border-radius: 9px; flex-shrink: 0;
    background: var(--gold-dim); border: 1px solid rgba(232,146,42,0.25);
    display: flex; align-items: center; justify-content: center;
  }
  .su-feature-text {
    font-size: 13px; color: var(--ink-5); font-family: var(--font-body); font-weight: 500;
  }

  /* Left footer */
  .su-left-footer {
    position: absolute; bottom: 32px; left: 50%; transform: translateX(-50%);
    font-size: 10px; color: var(--ink-6); font-family: var(--font-mono); letter-spacing: 0.08em;
    white-space: nowrap;
  }

  /* ── Right panel (branding) ── */
  .su-right {
    flex: 1 1 0; min-width: 0;
    display: flex; flex-direction: column;
    justify-content: center; align-items: center;
    padding: 56px 40px;
    background:
      radial-gradient(circle at top, rgba(232,146,42,0.06), transparent 38%),
      linear-gradient(180deg, var(--parchment) 0%, #f6efe4 100%);
    overflow-y: auto;
  }

  .su-brand-inner {
    width: 100%; max-width: 430px; position: relative; z-index: 1;
    display: flex; flex-direction: column; align-items: center; text-align: center;
  }

  /* Form card */
  .su-card {
    width: 100%; max-width: 480px;
    animation: fadeUp 0.6s var(--ease-out) 0.05s both;
    padding: 40px 38px;
    background: rgba(255,255,255,0.72);
    border: 1px solid rgba(232,146,42,0.12);
    border-radius: 30px;
    box-shadow: var(--shadow-xl);
    backdrop-filter: blur(14px);
  }

  .su-form-header {
    margin-bottom: 30px;
    animation: fadeUp 0.5s var(--ease-out) 0.12s both;
  }
  .su-form-eyebrow {
    font-family: var(--font-mono); font-size: 10px; font-weight: 500;
    color: var(--gold-2); letter-spacing: 0.15em; text-transform: uppercase;
    margin-bottom: 10px;
  }
  .su-form-title {
    font-family: var(--font-display); font-size: 36px; font-weight: 800;
    color: var(--ink); letter-spacing: -0.04em; line-height: 1.05;
    margin-bottom: 8px;
  }
  .su-form-sub {
    font-size: 15px; color: var(--ink-5); font-family: var(--font-body);
  }

  /* Divider rule under title */
  .su-title-rule {
    width: 48px; height: 2px; border-radius: 2px;
    background: linear-gradient(90deg, var(--gold), var(--gold-3));
    margin-top: 14px;
  }

  /* ── Fields ── */
  .su-fields { display: flex; flex-direction: column; gap: 20px; }

  .su-field {
    display: flex; flex-direction: column; gap: 7px;
    animation: fadeUp 0.45s var(--ease-out) both;
  }
  .su-field:nth-child(1) { animation-delay: 0.14s; }
  .su-field:nth-child(2) { animation-delay: 0.19s; }
  .su-field:nth-child(3) { animation-delay: 0.24s; }
  .su-field:nth-child(4) { animation-delay: 0.29s; }

  .su-label {
    font-size: 12.5px; font-weight: 600; color: var(--ink-4);
    font-family: var(--font-body); letter-spacing: 0.01em;
  }

  .su-input-wrap { position: relative; }

  .su-input {
    width: 100%; padding: 14px 18px 14px 46px;
    background: var(--parchment); border: 1.5px solid var(--parchment-3);
    border-radius: var(--r-md); color: var(--ink);
    font-family: var(--font-body); font-size: 15px; outline: none;
    transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
    box-shadow: var(--shadow-xs);
  }
  .su-input::placeholder { color: var(--ink-6); }
  .su-input:focus {
    background: var(--canvas);
    animation: field-glow 3s ease-in-out infinite;
  }
  .su-input:focus + .su-input-icon { color: var(--gold-2); }

  .su-input-icon {
    position: absolute; left: 15px; top: 50%; transform: translateY(-50%);
    color: var(--ink-6); pointer-events: none;
    transition: color 0.2s;
  }

  /* Password toggle */
  .su-pw-toggle {
    position: absolute; right: 14px; top: 50%; transform: translateY(-50%);
    background: none; border: none; cursor: pointer; padding: 4px;
    color: var(--ink-6); border-radius: 6px; transition: all 0.15s;
    display: flex; align-items: center; justify-content: center;
  }
  .su-pw-toggle:hover { color: var(--ink-4); background: var(--parchment-2); }
  .su-input.has-toggle { padding-right: 46px; }

  /* Password strength */
  .su-pw-strength { margin-top: 8px; }
  .su-pw-strength-bar-bg {
    height: 3px; background: var(--parchment-3); border-radius: 99px; overflow: hidden;
  }
  .su-pw-strength-bar {
    height: 100%; border-radius: 99px;
    transition: width 0.4s var(--ease-out), background-color 0.3s ease;
  }
  .su-pw-strength-label {
    font-size: 10.5px; font-family: var(--font-mono); margin-top: 5px; letter-spacing: 0.04em;
  }

  /* ── Alert message ── */
  .su-alert {
    padding: 13px 16px; border-radius: var(--r-md);
    font-size: 13px; font-family: var(--font-body); font-weight: 500;
    display: flex; align-items: flex-start; gap: 10px;
    animation: slide-down 0.25s var(--ease-out);
    margin-bottom: 24px;
  }
  .su-alert.error {
    background: var(--red-dim); color: var(--red);
    border: 1px solid rgba(192,57,43,0.2);
    animation: slide-down 0.25s var(--ease-out), error-shake 0.4s ease 0.25s;
  }
  .su-alert.success {
    background: var(--teal-dim); color: var(--teal);
    border: 1px solid rgba(26,138,122,0.22);
  }
  .su-alert-icon { flex-shrink: 0; margin-top: 1px; }

  /* ── Submit button ── */
  .su-submit {
    width: 100%; padding: 16px 24px;
    background: var(--ink); color: var(--parchment);
    border: none; border-radius: var(--r-md); cursor: pointer;
    font-family: var(--font-body); font-size: 15px; font-weight: 600;
    letter-spacing: 0.01em; box-shadow: var(--shadow-sm);
    transition: all 0.22s var(--ease-out);
    position: relative; overflow: hidden;
    display: flex; align-items: center; justify-content: center; gap: 10px;
    margin-top: 8px;
    animation: fadeUp 0.5s var(--ease-out) 0.34s both;
  }
  .su-submit::before {
    content: ''; position: absolute; top: 0; left: -80%; width: 50%; height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent);
    transition: left 0.55s ease;
  }
  .su-submit:hover:not(:disabled) { background: var(--ink-3); transform: translateY(-2px); box-shadow: var(--shadow-lg); }
  .su-submit:hover:not(:disabled)::before { left: 140%; }
  .su-submit:active:not(:disabled) { transform: translateY(0) scale(0.99); }
  .su-submit:disabled { background: var(--parchment-3); color: var(--ink-6); cursor: not-allowed; box-shadow: none; }
  .su-submit-spinner {
    width: 17px; height: 17px; border-radius: 50%;
    border: 2px solid rgba(247,242,233,0.3); border-top-color: var(--parchment);
    animation: spin 0.8s linear infinite; flex-shrink: 0;
  }

  /* ── Footer link ── */
  .su-footer {
    text-align: center; margin-top: 28px;
    animation: fadeUp 0.5s var(--ease-out) 0.4s both;
  }
  .su-footer-text { font-size: 14px; color: var(--ink-5); font-family: var(--font-body); }
  .su-footer-link {
    font-size: 14px; font-weight: 600; color: var(--gold-2);
    text-decoration: none; letter-spacing: 0.01em;
    transition: all 0.16s; position: relative; padding-bottom: 1px;
  }
  .su-footer-link::after {
    content: ''; position: absolute; bottom: 0; left: 0; width: 0; height: 1.5px;
    background: var(--gold-2); transition: width 0.25s var(--ease-out); border-radius: 2px;
  }
  .su-footer-link:hover { color: var(--gold); }
  .su-footer-link:hover::after { width: 100%; }

  /* ── Divider ── */
  .su-divider {
    display: flex; align-items: center; gap: 14px; margin: 24px 0;
  }
  .su-divider-line { flex: 1; height: 1px; background: var(--parchment-3); }
  .su-divider-label { font-size: 10.5px; color: var(--ink-6); font-family: var(--font-mono); letter-spacing: 0.08em; }

  /* ── Mobile: hide left panel ── */
  @media (max-width: 768px) {
    .su-left { display: none; }
    .su-right { padding: 24px 16px; }
    .su-card { max-width: 440px; padding: 30px 22px; border-radius: 24px; }
  }
`;

/* ── SVG Icons ── */
const IconUser = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="5.5" r="3" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M1.5 14c0-3.59 2.91-6.5 6.5-6.5s6.5 2.91 6.5 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);
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

/* ── Password strength ── */
const getStrength = (pw) => {
  if (!pw) return { score: 0, label: '', color: 'transparent', width: '0%' };
  let score = 0;
  if (pw.length >= 8)  score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { score, label: 'Weak',   color: '#c0392b', width: '20%' };
  if (score <= 2) return { score, label: 'Fair',   color: '#e8922a', width: '45%' };
  if (score <= 3) return { score, label: 'Good',   color: '#d4a017', width: '65%' };
  if (score <= 4) return { score, label: 'Strong', color: '#1a8a7a', width: '85%' };
  return { score, label: 'Excellent', color: '#1a8a7a', width: '100%' };
};

export default function Signup() {
  const { signup, loading } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const navigate = useNavigate();

  const strength = getStrength(password);
  const isSuccess = message && (message.includes('successful') || message.includes('Verification'));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');

    if (!fullName || fullName.trim().length < 2) {
      const m = 'Please enter your full name';
      setMessage(m);
      toast.error(m);
      return;
    }
    if (!email || !email.includes('@')) {
      const m = 'Please enter a valid email address';
      setMessage(m);
      toast.error(m);
      return;
    }
    if (!password) {
      const m = 'Please enter a password';
      setMessage(m);
      toast.error(m);
      return;
    }
    if (password !== confirmPassword) {
      const m = 'Passwords do not match!';
      setMessage(m);
      toast.error(m);
      return;
    }

    const result = await signup(email, password, fullName);
    if (result.success) {
      navigate('/verify-code', { state: { email } });
    } else {
      const m = result.message || 'Signup failed';
      setMessage(m);
      toast.error(m);
    }
  };

  return (
    <>
      <style>{STYLES}</style>

      <div className="su-page">
        {/* Grain */}
        <div className="su-grain" />

        {/* Background motif */}
        <div className="su-bg">
          <div className="su-bg-radial-1" />
          <div className="su-bg-radial-2" />
          <div className="su-bg-grid" />
          <svg className="su-bg-diag" width="440" height="440" viewBox="0 0 440 440">
            {[0, 80, 160, 240, 320].map(o => (
              <line key={o} x1={440} y1={o} x2={o} y2={440} stroke="#0e0b07" strokeWidth="1"/>
            ))}
          </svg>
        </div>

        <div className="su-layout">
          {/* ── Left form panel ── */}
          <div className="su-left">
            <div className="su-form-inner">
              <div className="su-form-header">
                <div className="su-form-eyebrow">Get started</div>
                <h1 className="su-form-title">Create your account</h1>
                <p className="su-form-sub">Join thousands making smarter decisions</p>
                <div className="su-title-rule" />
              </div>

              {message && (
                <div className={`su-alert ${isSuccess ? 'success' : 'error'}`}>
                  <span className="su-alert-icon">
                    {isSuccess ? <IconCheck /> : <IconAlert />}
                  </span>
                  {message}
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div className="su-fields">
                  <div className="su-field">
                    <label className="su-label" htmlFor="fullName">Full name</label>
                    <div className="su-input-wrap">
                      <input
                        id="fullName"
                        type="text"
                        required
                        className="su-input"
                        placeholder="Enter your full name"
                        value={fullName}
                        onChange={e => setFullName(e.target.value)}
                      />
                      <span className="su-input-icon"><IconUser /></span>
                    </div>
                  </div>

                  <div className="su-field">
                    <label className="su-label" htmlFor="email">Email address</label>
                    <div className="su-input-wrap">
                      <input
                        id="email"
                        type="email"
                        required
                        className="su-input"
                        placeholder="Enter your email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                      />
                      <span className="su-input-icon"><IconMail /></span>
                    </div>
                  </div>

                  <div className="su-field">
                    <label className="su-label" htmlFor="password">Password</label>
                    <div className="su-input-wrap">
                      <input
                        id="password"
                        type={showPw ? 'text' : 'password'}
                        required
                        className="su-input has-toggle"
                        placeholder="Create a password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                      />
                      <span className="su-input-icon"><IconLock /></span>
                      <button type="button" className="su-pw-toggle" onClick={() => setShowPw(v => !v)}>
                        <IconEye off={showPw} />
                      </button>
                    </div>
                    {password && (
                      <div className="su-pw-strength">
                        <div className="su-pw-strength-bar-bg">
                          <div className="su-pw-strength-bar" style={{ width: strength.width, backgroundColor: strength.color, transition: 'width 0.4s, background-color 0.3s' }} />
                        </div>
                        <div className="su-pw-strength-label" style={{ color: strength.color }}>{strength.label}</div>
                      </div>
                    )}
                  </div>

                  <div className="su-field">
                    <label className="su-label" htmlFor="confirmPassword">Confirm password</label>
                    <div className="su-input-wrap">
                      <input
                        id="confirmPassword"
                        type={showConfirmPw ? 'text' : 'password'}
                        required
                        className="su-input has-toggle"
                        placeholder="Confirm your password"
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        style={confirmPassword && confirmPassword !== password ? { borderColor: 'var(--red)', boxShadow: '0 0 0 3px var(--red-dim)' } : confirmPassword && confirmPassword === password ? { borderColor: 'var(--teal)', boxShadow: '0 0 0 3px var(--teal-dim)' } : {}}
                      />
                      <span className="su-input-icon"><IconLock /></span>
                      <button type="button" className="su-pw-toggle" onClick={() => setShowConfirmPw(v => !v)}>
                        <IconEye off={showConfirmPw} />
                      </button>
                    </div>
                    {confirmPassword && (
                      <div style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', marginTop: 5, letterSpacing: '0.04em', color: confirmPassword === password ? 'var(--teal)' : 'var(--red)', animation: 'slide-down 0.2s ease' }}>
                        {confirmPassword === password ? '✓ Passwords match' : '✗ Passwords do not match'}
                      </div>
                    )}
                  </div>
                </div>

                <button type="submit" className="su-submit" disabled={loading}>
                  {loading ? (
                    <><span className="su-submit-spinner" />Creating account…</>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M8 1.5v13M1.5 8h13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                      Create account
                    </>
                  )}
                </button>
              </form>

              <div className="su-footer">
                <span className="su-footer-text">Already have an account? </span>
                <a href="/login" className="su-footer-link">Sign in</a>
              </div>

              <p style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: 'var(--ink-6)', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em', lineHeight: 1.6 }}>
                By creating an account you agree to our<br />
                <a href="#" style={{ color: 'var(--gold-2)', textDecoration: 'none' }}>Terms of Service</a>
                {' '}and{' '}
                <a href="#" style={{ color: 'var(--gold-2)', textDecoration: 'none' }}>Privacy Policy</a>
              </p>
            </div>
          </div>

          {/* ── Right branding panel ── */}
          <div className="su-right">
            <div className="su-brand-inner">
              <div className="su-left-radial" />
              <div className="su-left-bottom" />

              <div className="su-logo-wrap">
                <div className="su-logo-orb">
                  <div className="su-pulse-ring" />
                  <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
                    <circle cx="22" cy="22" r="22" fill="rgba(232,146,42,0.08)"/>
                    <path d="M22 10a12 12 0 100 24 12 12 0 000-24zm0 4.8c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 16.8c-2.67 0-5.04-1.36-6.44-3.44.05-2.13 4.3-3.31 6.44-3.31 2.14 0 6.39 1.18 6.44 3.31A7.52 7.52 0 0122 31.6z" fill="var(--gold)"/>
                  </svg>
                  <span className="su-orbit-dot-1" />
                  <span className="su-orbit-dot-2" />
                </div>
              </div>

              <div className="su-eyebrow">KE Smart Change</div>
              <h2 className="su-brand-title">
                Smarter<br />decisions, <em>together</em>
              </h2>
              <p className="su-brand-sub">
                A unified platform for intelligent change management across your organization.
              </p>

              <div className="su-features">
                {[
                  { icon: '◆', text: 'AI-powered insights & recommendations' },
                  { icon: '◈', text: 'Real-time collaboration tools' },
                  { icon: '✦', text: 'Cited, grounded decision support' },
                ].map(({ icon, text }) => (
                  <div key={text} className="su-feature-item">
                    <div className="su-feature-dot">
                      <span style={{ fontSize: 11, color: 'var(--gold-2)' }}>{icon}</span>
                    </div>
                    <span className="su-feature-text">{text}</span>
                  </div>
                ))}
              </div>


            </div>
          </div>
        </div>
      </div>
    </>
  );
}