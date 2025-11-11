import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
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

const Login = () => {
  const navigate = useNavigate(); // Add this
  const { login, verifyCode, requestCode, loginWithGoogle, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState('password');
  const [message, setMessage] = useState('');

  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    setMessage('');

    try {
      const result = await login(email, password);

      console.log('Backend login response:', result);

      // --- CASE 1: Full success (verified user) ---
      if (result.success) {
        setMessage('Login successful!');
        setTimeout(() => (window.location.href = '/employee/myteams'), 1500);
        return;
      }

      // --- CASE 2: Unverified email (backend may return success=false or different message) ---
      const msg = result.message?.toLowerCase() || '';
      if (
        msg.includes('unverified') ||
        msg.includes('verify your email') ||
        msg.includes('verification code') ||
        msg.includes('otp') ||
        msg.includes('Please verify your email to continue')
      ) {
        console.log('Email unverified → redirecting to verify page');
        navigate('/verify-code', { state: { email } });
        return;
      }

      // --- CASE 3: Invalid login ---
      setMessage(result.message || 'Invalid email or password');
    } catch (error) {
      console.error('Login error:', error);
      setMessage('Something went wrong. Please try again.');
    }
  };



  const handleGoogleLogin = async () => {
    try {
      setMessage('');
      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken(true);

      console.log('=== DEBUG Firebase Login ===');
      console.log('User Email:', result.user.email);
      console.log('ID Token (first 50 chars):', idToken.substring(0, 50));
      console.log('Token length:', idToken.length);

      const response = await loginWithGoogle(idToken);

      console.log('Backend response:', response);

      if (response.success) {
        setStep('verified');
        setMessage('Login successful!');
        setTimeout(() => window.location.href = '/employee/myteams', 1500);
      } else {
        setMessage(response.message || 'Google login failed');
      }
    } catch (err) {
      console.error("Full error object:", err);
      console.error("Error response:", err.response?.data);
      setMessage(err.response?.data?.message || 'Failed to sign in with Google');
    }
  };
  const handleRequestCode = async () => {
    const result = await requestCode(email);
    setMessage(result.message || (result.success ? 'Code resent' : 'Failed to resend'));
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setMessage('');

    const result = await verifyCode(email, code);

    if (result.success) {
      setStep('verified');
      setMessage('Login successful!');
      setTimeout(() => window.location.href = '/employee/myteams', 1500);
    } else {
      setMessage(result.message || 'Invalid code');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-8">
      <Card className="w-full max-w-md p-8 shadow-md border-0 bg-white">
        <div className="mb-8 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-gradient-to-br from-[#FDB913] to-[#F58220] shadow-lg">
            <span className="text-2xl font-bold text-white">KE</span>
          </div>
        </div>

        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold text-[#333333]">
            KE Smart Change
          </h1>
          <p className="text-sm text-gray-600 font-medium">
            {step === 'code-requested' ? 'Enter verification code' : 'Sign in to continue'}
          </p>
        </div>

        {message && (
          <div className={`mb-4 rounded-lg p-3 text-center text-sm ${message.includes('successful') ? 'bg-[rgba(120,190,32,0.1)] text-[#6AAD1C] border border-[rgba(120,190,32,0.3)]' : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
            {message}
          </div>
        )}

        {step === 'password' && (
          <>
            <div className="space-y-6">
              <Input
                label="Email"
                type="email"
                id="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Input
                label="Password"
                type="password"
                id="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <Button onClick={handlePasswordLogin} disabled={loading}>
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
              <div className="text-center">
                <span className="text-sm text-gray-600">Don't have an account? </span>
                <a href="/signup" className="text-sm font-semibold text-[#F58220] transition-colors hover:text-[#E0741C] hover:underline">
                  Signup
                </a>
              </div>
            </div>

            {/* Google Sign-in */}
            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="bg-white px-2 text-gray-500">Or continue with</span>
                </div>
              </div>

              <button
                onClick={handleGoogleLogin}
                disabled={loading}
                className="mt-4 flex w-full items-center justify-center gap-3 rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Sign in with Google
              </button>
            </div>
          </>
        )}



        {step === 'verified' && (
          <div className="space-y-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <span className="text-3xl">✓</span>
            </div>
            <p className="text-lg font-semibold text-green-600">{message}</p>
          </div>
        )}

        {step === 'password' && (
          <div className="mt-6 text-center">
            <a href="/forgot-password" className="text-sm font-semibold text-[#F58220] transition-colors hover:text-[#E0741C] hover:underline">
              Forgot Password?
            </a>
          </div>
        )}
      </Card>
    </div>
  );
};

export default Login;