import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import toast from 'react-hot-toast';

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,600;0,9..144,700;0,9..144,800;0,9..144,900;1,9..144,300;1,9..144,400;1,9..144,600&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=DM+Mono:wght@300;400;500&display=swap');

  :root {
    --ink: #0e0b07;
    --ink-2: #1c1710;
    --ink-3: #2e2619;
    --ink-4: rgba(14,11,7,0.78);
    --ink-5: rgba(14,11,7,0.52);
    --ink-6: rgba(14,11,7,0.34);
    --ink-7: rgba(14,11,7,0.16);

    --parchment: #f7f2e9;
    --parchment-2: #f0e9db;
    --parchment-3: #e8dece;
    --parchment-4: #d8ccb8;

    --canvas: #faf6ef;

    --gold: #e8922a;
    --gold-2: #c97a18;
    --gold-3: #f5aa55;
    --gold-dim: rgba(232,146,42,0.13);
    --gold-line: rgba(232,146,42,0.4);

    --teal: #1a8a7a;
    --teal-dim: rgba(26,138,122,0.11);
    --red: #c0392b;
    --red-dim: rgba(192,57,43,0.09);

    --font-display: 'Fraunces', Georgia, serif;
    --font-body: 'DM Sans', system-ui, sans-serif;
    --font-mono: 'DM Mono', monospace;

    --r-md: 16px;
    --shadow-xs: 0 1px 4px rgba(14,11,7,0.07);
    --shadow-sm: 0 2px 10px rgba(14,11,7,0.1), 0 1px 3px rgba(14,11,7,0.06);
    --shadow-md: 0 6px 24px rgba(14,11,7,0.13), 0 2px 8px rgba(14,11,7,0.07);
    --shadow-lg: 0 14px 44px rgba(14,11,7,0.17), 0 4px 14px rgba(14,11,7,0.08);
    --shadow-xl: 0 28px 72px rgba(14,11,7,0.22), 0 8px 28px rgba(14,11,7,0.1);

    --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
    --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  ::selection { background: var(--gold-dim); color: var(--ink); }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-thumb { background: var(--parchment-3); border-radius: 99px; }

  @keyframes fadeUp { from { opacity: 0; transform: translateY(22px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
  @keyframes float { 0%,100% { transform: translateY(0px) rotate(0deg); } 33% { transform: translateY(-7px) rotate(1deg); } 66% { transform: translateY(-3px) rotate(-0.5deg); } }
  @keyframes logo-breathe { 0%,100% { box-shadow: 0 0 0 5px rgba(232,146,42,0.08), 0 0 28px rgba(232,146,42,0.12), var(--shadow-md); } 50% { box-shadow: 0 0 0 8px rgba(232,146,42,0.13), 0 0 48px rgba(232,146,42,0.20), var(--shadow-md); } }
  @keyframes orbit-1 { from { transform: rotate(0deg) translateX(38px) rotate(0deg); } to { transform: rotate(360deg) translateX(38px) rotate(-360deg); } }
  @keyframes orbit-2 { from { transform: rotate(0deg) translateX(56px) rotate(0deg); } to { transform: rotate(-360deg) translateX(56px) rotate(360deg); } }
  @keyframes pulse-ring { 0% { transform: scale(1); opacity: 0.55; } 100% { transform: scale(1.7); opacity: 0; } }
  @keyframes grain { 0%,100% { transform: translate(0,0); } 50% { transform: translate(-2%, -2%); } }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes slide-down { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes error-shake { 0%,100% { transform: translateX(0); } 20% { transform: translateX(-5px); } 40% { transform: translateX(5px); } 60% { transform: translateX(-3px); } 80% { transform: translateX(3px); } }
  @keyframes field-glow { 0%,100% { border-color: rgba(232,146,42,0.45); box-shadow: 0 0 0 4px var(--gold-dim); } 50% { border-color: rgba(232,146,42,0.70); box-shadow: 0 0 0 5px rgba(232,146,42,0.10); } }

  .lg-page { min-height: 100vh; display: flex; background: var(--canvas); font-family: var(--font-body); position: relative; overflow: hidden; }
  .lg-grain { position: fixed; inset: 0; pointer-events: none; z-index: 999; opacity: 0.022; background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"); background-size: 200px 200px; animation: grain 0.45s steps(1) infinite; mix-blend-mode: multiply; }
  .lg-bg { position: fixed; inset: 0; pointer-events: none; z-index: 0; overflow: hidden; }
  .lg-bg-r1 { position: absolute; top: -200px; right: -200px; width: 700px; height: 700px; border-radius: 50%; background: radial-gradient(circle, rgba(232,146,42,0.08) 0%, transparent 62%); }
  .lg-bg-r2 { position: absolute; bottom: -300px; left: -100px; width: 600px; height: 600px; border-radius: 50%; background: radial-gradient(circle, rgba(26,138,122,0.05) 0%, transparent 62%); }
  .lg-bg-grid { position: absolute; inset: 0; opacity: 0.016; background-image: linear-gradient(var(--ink) 1px, transparent 1px), linear-gradient(90deg, var(--ink) 1px, transparent 1px); background-size: 72px 72px; }
  .lg-layout { display: flex; width: 100%; min-height: 100vh; position: relative; z-index: 1; }
  .lg-left, .lg-right { flex: 1 1 0; min-width: 0; display: flex; align-items: center; justify-content: center; padding: 56px 40px; position: relative; overflow: hidden; }
  .lg-left { background: linear-gradient(180deg, rgba(250,246,239,0.96) 0%, rgba(248,243,235,0.98) 100%); border-right: 1px solid var(--parchment-3); }
  .lg-right { background: radial-gradient(circle at top, rgba(232,146,42,0.06), transparent 38%), linear-gradient(180deg, var(--parchment) 0%, #f6efe4 100%); }
  .lg-left-inner, .lg-right-inner { width: 100%; max-width: 430px; position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; text-align: center; }
  .lg-left-r1 { position: absolute; top: -120px; right: -120px; width: 380px; height: 380px; border-radius: 50%; pointer-events: none; background: radial-gradient(circle, rgba(232,146,42,0.09) 0%, transparent 65%); }
  .lg-left-r2 { position: absolute; bottom: -80px; left: -80px; width: 300px; height: 300px; border-radius: 50%; pointer-events: none; background: radial-gradient(circle, rgba(26,138,122,0.06) 0%, transparent 65%); }
  .lg-logo-wrap { position: relative; margin-bottom: 36px; animation: float 5s ease-in-out infinite; }
  .lg-logo-orb { width: 88px; height: 88px; border-radius: 28px; background: var(--ink); display: flex; align-items: center; justify-content: center; position: relative; animation: logo-breathe 4s ease-in-out infinite; }
  .lg-logo-orb::before { content: ''; position: absolute; inset: -16px; border-radius: 40px; border: 1px dashed rgba(232,146,42,0.24); }
  .lg-logo-orb::after { content: ''; position: absolute; inset: -30px; border-radius: 56px; border: 1px dashed rgba(232,146,42,0.11); }
  .lg-orbit-1 { position: absolute; width: 9px; height: 9px; border-radius: 50%; background: var(--gold); box-shadow: 0 0 10px rgba(232,146,42,0.7); animation: orbit-1 8s linear infinite; top: 50%; left: 50%; margin: -4.5px; }
  .lg-orbit-2 { position: absolute; width: 6px; height: 6px; border-radius: 50%; background: var(--teal); opacity: 0.7; animation: orbit-2 13s linear infinite; top: 50%; left: 50%; margin: -3px; }
  .lg-pulse { position: absolute; inset: -5px; border-radius: 32px; border: 1.5px solid rgba(232,146,42,0.4); animation: pulse-ring 3.5s ease-out infinite; }
  .lg-eyebrow { font-family: var(--font-mono); font-size: 10px; font-weight: 500; color: var(--gold-2); letter-spacing: 0.18em; text-transform: uppercase; margin-bottom: 16px; display: flex; align-items: center; justify-content: center; gap: 10px; animation: fadeUp 0.5s var(--ease-out) 0.1s both; }
  .lg-eyebrow::before, .lg-eyebrow::after { content: ''; display: block; width: 28px; height: 1px; background: var(--gold-3); opacity: 0.55; }
  .lg-brand-title { font-family: var(--font-display); font-size: 48px; font-weight: 800; color: var(--ink); letter-spacing: -0.04em; line-height: 1.05; margin-bottom: 16px; animation: fadeUp 0.55s var(--ease-out) 0.15s both; }
  .lg-brand-title em { font-style: italic; font-weight: 300; color: var(--ink-5); }
  .lg-brand-sub { font-family: var(--font-display); font-style: italic; font-size: 16px; color: var(--ink-5); line-height: 1.65; margin-bottom: 36px; max-width: 340px; animation: fadeUp 0.55s var(--ease-out) 0.22s both; }
  .lg-features { display: flex; flex-direction: column; gap: 12px; width: 100%; animation: fadeUp 0.55s var(--ease-out) 0.3s both; }
  .lg-feat { display: flex; align-items: center; gap: 12px; justify-content: center; }
  .lg-feat-dot { width: 28px; height: 28px; border-radius: 9px; flex-shrink: 0; background: var(--gold-dim); border: 1px solid rgba(232,146,42,0.25); display: flex; align-items: center; justify-content: center; }
  .lg-feat-text { font-size: 13px; color: var(--ink-5); font-family: var(--font-body); font-weight: 500; max-width: 280px; }
  .lg-left-foot { position: absolute; bottom: 32px; left: 50%; transform: translateX(-50%); font-size: 10px; color: var(--ink-6); font-family: var(--font-mono); letter-spacing: 0.08em; white-space: nowrap; }
  .lg-card { width: 100%; max-width: 520px; animation: fadeUp 0.6s var(--ease-out) 0.05s both; padding: 40px 38px; background: rgba(255,255,255,0.72); border: 1px solid rgba(232,146,42,0.12); border-radius: 30px; box-shadow: var(--shadow-xl); backdrop-filter: blur(14px); }
  .lg-form-head { margin-bottom: 30px; animation: fadeUp 0.5s var(--ease-out) 0.12s both; }
  .lg-form-eyebrow { font-family: var(--font-mono); font-size: 10px; font-weight: 500; color: var(--gold-2); letter-spacing: 0.15em; text-transform: uppercase; margin-bottom: 10px; }
  .lg-form-title { font-family: var(--font-display); font-size: 36px; font-weight: 800; color: var(--ink); letter-spacing: -0.04em; line-height: 1.05; margin-bottom: 8px; }
  .lg-form-sub { font-size: 15px; color: var(--ink-5); font-family: var(--font-body); }
  .lg-title-rule { width: 48px; height: 2px; border-radius: 2px; margin-top: 14px; background: linear-gradient(90deg, var(--gold), var(--gold-3)); }
  .lg-fields { display: flex; flex-direction: column; gap: 20px; }
  .lg-field { display: flex; flex-direction: column; gap: 7px; animation: fadeUp 0.45s var(--ease-out) both; }
  .lg-field:nth-child(1) { animation-delay: 0.14s; }
  .lg-field:nth-child(2) { animation-delay: 0.2s; }
  .lg-label { font-size: 12.5px; font-weight: 600; color: var(--ink-4); font-family: var(--font-body); letter-spacing: 0.01em; text-align: left; }
  .lg-input-wrap { position: relative; }
  .lg-input { width: 100%; padding: 15px 18px 15px 46px; background: rgba(247,242,233,0.85); border: 1.5px solid var(--parchment-3); border-radius: var(--r-md); color: var(--ink); font-family: var(--font-body); font-size: 15px; outline: none; transition: border-color 0.2s, box-shadow 0.2s, background 0.2s; box-shadow: var(--shadow-xs); }
  .lg-input::placeholder { color: var(--ink-6); }
  .lg-input:focus { background: var(--canvas); animation: field-glow 3s ease-in-out infinite; }
  .lg-input:focus + .lg-icon { color: var(--gold-2); }
  .lg-input.has-toggle { padding-right: 46px; }
  .lg-icon { position: absolute; left: 15px; top: 50%; transform: translateY(-50%); color: var(--ink-6); pointer-events: none; transition: color 0.2s; }
  .lg-pw-toggle { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; padding: 4px; color: var(--ink-6); border-radius: 6px; transition: all 0.15s; display: flex; align-items: center; justify-content: center; }
  .lg-pw-toggle:hover { color: var(--ink-4); background: var(--parchment-2); }
  .lg-alert { padding: 13px 16px; border-radius: var(--r-md); font-size: 13px; font-family: var(--font-body); font-weight: 500; display: flex; align-items: flex-start; gap: 10px; margin-bottom: 24px; }
  .lg-alert.error { background: var(--red-dim); color: var(--red); border: 1px solid rgba(192,57,43,0.2); animation: slide-down 0.25s var(--ease-out), error-shake 0.4s ease 0.25s; }
  .lg-alert.success { background: var(--teal-dim); color: var(--teal); border: 1px solid rgba(26,138,122,0.22); animation: slide-down 0.25s var(--ease-out); }
  .lg-alert-icon { flex-shrink: 0; margin-top: 1px; }
  .lg-submit { width: 100%; padding: 16px 24px; margin-top: 8px; background: var(--ink); color: var(--parchment); border: none; border-radius: var(--r-md); cursor: pointer; font-family: var(--font-body); font-size: 15px; font-weight: 600; letter-spacing: 0.01em; box-shadow: var(--shadow-sm); transition: all 0.22s var(--ease-out); position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; gap: 10px; animation: fadeUp 0.5s var(--ease-out) 0.28s both; }
  .lg-submit:hover:not(:disabled) { background: var(--ink-3); transform: translateY(-2px); box-shadow: var(--shadow-lg); }
  .lg-submit:active:not(:disabled) { transform: translateY(0) scale(0.99); }
  .lg-submit:disabled { background: var(--parchment-3); color: var(--ink-6); cursor: not-allowed; box-shadow: none; }
  .lg-spinner { width: 17px; height: 17px; border-radius: 50%; border: 2px solid rgba(247,242,233,0.3); border-top-color: var(--parchment); animation: spin 0.8s linear infinite; flex-shrink: 0; }
  .lg-link { font-weight: 600; color: var(--gold-2); text-decoration: none; letter-spacing: 0.01em; transition: all 0.16s; position: relative; padding-bottom: 1px; }
  .lg-link:hover { color: var(--gold); }
  .lg-divider { display: flex; align-items: center; gap: 14px; margin: 24px 0; }
  .lg-divider-line { flex: 1; height: 1px; background: var(--parchment-3); }
  .lg-divider-text { font-size: 10.5px; color: var(--ink-6); font-family: var(--font-mono); letter-spacing: 0.08em; white-space: nowrap; }
  .lg-google { width: 100%; padding: 14px 24px; background: var(--parchment); border: 1.5px solid var(--parchment-3); border-radius: var(--r-md); cursor: pointer; font-family: var(--font-body); font-size: 14px; font-weight: 600; color: var(--ink-4); letter-spacing: 0.01em; display: flex; align-items: center; justify-content: center; gap: 12px; transition: all 0.2s var(--ease-out); box-shadow: var(--shadow-xs); position: relative; overflow: hidden; }
  .lg-google:hover { border-color: var(--parchment-4); color: var(--ink); background: var(--parchment-2); box-shadow: var(--shadow-sm); transform: translateY(-1px); }
  .lg-google:disabled { opacity: 0.5; cursor: not-allowed; }
  .lg-forgot { display: flex; justify-content: flex-end; margin-top: -8px; }
  .lg-forgot-link { font-family: var(--font-mono); font-size: 11px; font-weight: 500; color: var(--ink-6); letter-spacing: 0.04em; text-decoration: none; transition: color 0.15s; }
  .lg-forgot-link:hover { color: var(--gold-2); }
  .lg-footer { text-align: center; margin-top: 28px; animation: fadeUp 0.5s var(--ease-out) 0.38s both; }
  .lg-footer-text { font-size: 14px; color: var(--ink-5); font-family: var(--font-body); }
  .lg-verified { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 20px; padding: 20px 0; animation: fadeUp 0.5s var(--ease-spring); }
  .lg-verified-ring { width: 80px; height: 80px; border-radius: 50%; background: var(--teal-dim); border: 2px solid rgba(26,138,122,0.3); display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 8px rgba(26,138,122,0.07); }
  .lg-verified-title { font-family: var(--font-display); font-size: 24px; font-weight: 700; color: var(--teal); letter-spacing: -0.02em; }
  .lg-verified-sub { font-size: 14px; color: var(--ink-5); font-family: var(--font-mono); letter-spacing: 0.04em; }

  @media (max-width: 768px) {
    .lg-left { display: none; }
    .lg-right { padding: 24px 16px; }
    .lg-card { max-width: 440px; padding: 30px 22px; border-radius: 24px; }
  }
`;

const IconMail = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="1.5" y="3.5" width="13" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
    <path d="M1.5 5.5l6.5 4 6.5-4" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
  </svg>
);

const IconLock = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="3" y="7" width="10" height="7.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
    <path d="M5 7V5a3 3 0 016 0v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="8" cy="10.5" r="1" fill="currentColor" />
  </svg>
);

const IconEye = ({ off }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    {off ? (
      <>
        <path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" stroke="currentColor" strokeWidth="1.4" />
        <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.4" />
        <path d="M2 2l12 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </>
    ) : (
      <>
        <path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" stroke="currentColor" strokeWidth="1.4" />
        <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.4" />
      </>
    )}
  </svg>
);

const IconAlert = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
    <circle cx="7.5" cy="7.5" r="6.5" stroke="currentColor" strokeWidth="1.4" />
    <path d="M7.5 4.5v4M7.5 10.5v.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

const IconCheck = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
    <circle cx="7.5" cy="7.5" r="6.5" stroke="currentColor" strokeWidth="1.4" />
    <path d="M4.5 7.5l2 2 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconCheckBig = () => (
  <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
    <path d="M7 18l8 8L29 10" stroke="var(--teal)" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" style={{ strokeDasharray: 40, strokeDashoffset: 40, animation: 'check-draw 0.5s ease 0.1s forwards' }} />
  </svg>
);

function AdminLogin() {
  const { login, loading, error } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [showPw, setShowPw] = useState(false);
  const navigate = useNavigate();

  const isSuccess = message && message.includes('successful');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');

    if (!email || !email.includes('@')) {
      const m = 'Please enter a valid email address';
      setMessage(m);
      toast.error(m);
      return;
    }

    if (!password) {
      const m = 'Please enter your password';
      setMessage(m);
      toast.error(m);
      return;
    }

    const res = await login(email, password);
    if (res.success) {
      toast.success('Login successful! Redirecting...');
      setMessage('Login successful! Redirecting...');
      setTimeout(() => {
        window.location.href = '/admin';
      }, 1000);
      return;
    }

    const m = res.message || error || 'Invalid email or password';
    setMessage(m);
    toast.error(m);
  };

  return (
    <>
      <style>{STYLES}</style>

      <div className="lg-page">
        <div className="lg-grain" />

        <div className="lg-bg">
          <div className="lg-bg-r1" />
          <div className="lg-bg-r2" />
          <div className="lg-bg-grid" />
        </div>

        <div className="lg-layout">
          <div className="lg-left">
            <div className="lg-left-r1" />
            <div className="lg-left-r2" />

            <div className="lg-left-inner">
              <div className="lg-logo-wrap">
                <div className="lg-logo-orb">
                  <div className="lg-pulse" />
                  <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
                    <circle cx="22" cy="22" r="22" fill="rgba(232,146,42,0.08)" />
                    <path d="M22 10a12 12 0 100 24 12 12 0 000-24zm0 4.8c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 16.8c-2.67 0-5.04-1.36-6.44-3.44.05-2.13 4.3-3.31 6.44-3.31 2.14 0 6.39 1.18 6.44 3.31A7.52 7.52 0 0122 31.6z" fill="var(--gold)" />
                  </svg>
                  <span className="lg-orbit-1" />
                  <span className="lg-orbit-2" />
                </div>
              </div>

              <div className="lg-eyebrow">KE Smart Change</div>
              <h2 className="lg-brand-title">Admin<br /><em>Portal</em></h2>
              <p className="lg-brand-sub">Secure access for administrators managing the platform.</p>

              <div className="lg-features">
                {[
                  { icon: '◆', text: 'Restricted administrative access' },
                  { icon: '◈', text: 'Operational oversight and control' },
                  { icon: '✦', text: 'Protected workflows and settings' },
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
          </div>

          <div className="lg-right">
            <div className="lg-right-inner">
              <div className="lg-card">
                {message.includes('successful') ? (
                  <div className="lg-verified">
                    <div className="lg-verified-ring">
                      <IconCheckBig />
                    </div>
                    <div>
                      <div className="lg-verified-title">You're in!</div>
                      <div className="lg-verified-sub" style={{ marginTop: 6 }}>Redirecting to the admin dashboard…</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                      <span style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(26,138,122,0.3)', borderTopColor: 'var(--teal)', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
                      <span style={{ fontSize: 12, color: 'var(--ink-6)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>Loading dashboard</span>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="lg-form-head">
                      <div className="lg-form-eyebrow">Admin sign in</div>
                      <h1 className="lg-form-title">Welcome back</h1>
                      <p className="lg-form-sub">Sign in to manage Smart Change.</p>
                      <div className="lg-title-rule" />
                    </div>

                    {(error || message) && (
                      <div className={`lg-alert ${isSuccess ? 'success' : 'error'}`}>
                        <span className="lg-alert-icon">{isSuccess ? <IconCheck /> : <IconAlert />}</span>
                        {message || error}
                      </div>
                    )}

                    <form onSubmit={handleSubmit}>
                      <div className="lg-fields">
                        <div className="lg-field">
                          <label className="lg-label" htmlFor="email">Email address</label>
                          <div className="lg-input-wrap">
                            <input
                              id="email"
                              type="email"
                              required
                              className="lg-input"
                              placeholder="Enter your email"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                            />
                            <span className="lg-icon"><IconMail /></span>
                          </div>
                        </div>

                        <div className="lg-field">
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <label className="lg-label" htmlFor="password">Password</label>
                          </div>
                          <div className="lg-input-wrap">
                            <input
                              id="password"
                              type={showPw ? 'text' : 'password'}
                              required
                              className="lg-input has-toggle"
                              placeholder="Enter your password"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                            />
                            <span className="lg-icon"><IconLock /></span>
                            <button type="button" className="lg-pw-toggle" onClick={() => setShowPw(v => !v)}>
                              <IconEye off={showPw} />
                            </button>
                          </div>
                        </div>
                      </div>

                      <button type="submit" className="lg-submit" disabled={loading}>
                        {loading ? (
                          <><span className="lg-spinner" />Signing in…</>
                        ) : (
                          <>
                            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                              <path d="M13 7.5L8 3M13 7.5L8 12M13 7.5H2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            Sign in
                          </>
                        )}
                      </button>
                    </form>

                    <div className="lg-footer">
                      <span className="lg-footer-text">Need access? Contact an administrator. </span>
                      <a href="/login" className="lg-link">User login</a>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default AdminLogin;