import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
// import { initializeApp } from "firebase/app";
// import { getAuth, GoogleAuthProvider, signInWithPopup, } from "firebase/auth";


// const firebaseConfig = {
//   apiKey: "AIzaSyB-t_v2ogrvHuae0YDfdn_nlyC0_wpdbVc",
//   authDomain: "smartchange-7e54c.firebaseapp.com",
//   projectId: "smartchange-7e54c",
//   storageBucket: "smartchange-7e54c.firebasestorage.app",
//   messagingSenderId: "860919795899",
//   appId: "1:860919795899:web:282a7cf3e0699c7cdb999e"
// };

// const app = initializeApp(firebaseConfig);
// const auth = getAuth(app);
// const provider = new GoogleAuthProvider();

const Login = () => {
  const { handleFirebaseLogin } = useAuth();
  const { login, verifyCode, requestCode, loading, error, setError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState('password');
  const [message, setMessage] = useState('');

  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    setMessage('');

    const result = await login(email, password);

    if (result.requiresCode) {
      setStep('code-requested');
      setMessage('OTP sent to your email. Enter it below.');
    } else if (result.success) {
      setStep('verified');
      setMessage('Login successful!');
      setTimeout(() => window.location.href = '/admin', 1500);
    } else {
      setMessage(result.message || 'Login failed');
    }
  };
  
  // const doGoogleLogin = async () => {
  //   try {
  //     const result = await signInWithPopup(auth, provider);
  //     const idToken = await result.user.getIdToken();
  //     await handleFirebaseLogin(idToken);
  //   } catch (err) {
  //     console.error("Google login error:", err);
  //   }
  // };

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
      setTimeout(() => window.location.href = '/admin', 1500);
    } else {
      setMessage(result.message || 'Invalid code');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-4 py-8">
      <Card className="w-full max-w-md p-8">
        <div className="mb-8 flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[#FDB913] to-[#F58220] shadow-lg">
            <span className="text-3xl font-bold text-white">KE</span>
          </div>
        </div>

        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold text-[#333333]">KE Smart Change</h1>
          <p className="text-sm text-gray-600">
            {step === 'code-requested' ? 'Enter verification code' : 'Sign in to continue'}
          </p>
        </div>

        {message && (
          <div className={`mb-4 rounded-lg p-3 text-center text-sm ${message.includes('successful') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
            {message}
          </div>
        )}

        {step === 'password' && (
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
              <a href="/signup" className="text-sm font-medium text-[#F58220] transition-colors hover:text-[#FDB913] hover:underline">
                Signup
              </a>
            </div>
          </div>
        )}

        {step === 'code-requested' && (
          <div className="space-y-6">
            <p className="text-center text-sm text-gray-600">
              We sent a verification code to <span className="font-semibold text-[#F58220]">{email}</span>
            </p>
            <Input
              label="Verification Code"
              type="text"
              id="code"
              placeholder="Enter 6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
            <Button onClick={handleVerifyCode} disabled={loading}>
              {loading ? 'Verifying...' : 'Verify Code'}
            </Button>
            <Button onClick={handleRequestCode} variant="secondary" disabled={loading}>
              Resend Code
            </Button>
          </div>
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
            <a href="/forgot-password" className="text-sm font-medium text-[#F58220] transition-colors hover:text-[#FDB913] hover:underline">
              Forgot Password?
            </a>
          </div>
        )}
        <div className="mt-4">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white px-2 text-gray-500">Or continue with</span>
              {/* <Button onClick={doGoogleLogin}>Continue with Google</Button> */}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default Login;