import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import toast from 'react-hot-toast';

export default function VerifyCode() {
  const { verifySignupCode, resendSignupCode, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const email = location.state?.email || '';
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');

  const handleVerify = async (e) => {
    e.preventDefault();
    setMessage('');

    const result = await verifySignupCode(email, code);

    if (result.success) {
      toast.success('Account verified! Redirecting to login...');
      setMessage('Account verified! Redirecting to login...');
      setTimeout(() => navigate('/login'), 2000);
    } else {
      const m = result.message || 'Invalid code';
      setMessage(m);
      toast.error(m);
    }
  };

  const handleResend = async () => {
    const result = await resendSignupCode(email);
    const m = result.message || (result.success ? 'OTP resent' : 'Failed to resend');
    setMessage(m);
    result.success ? toast.success(m) : toast.error(m);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-8">
      <Card className="w-full max-w-md p-8 shadow-md border-0 bg-white">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-gradient-to-br from-[#FDB913] to-[#f7953f] shadow-lg">
            <span className="text-2xl font-bold text-white">KE</span>
          </div>
        </div>

        {/* Title & Description */}
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold text-[#333333]">Verify Your Account</h1>
          <p className="text-sm text-gray-600 font-medium">
            We sent a verification code to
          </p>
          <p className="mt-1 font-semibold text-[#f7953f]">{email}</p>
        </div>

        {/* Message Display */}
        {message && (
          <div className={`mb-4 rounded-lg p-3 text-center text-sm ${
            message.includes('verified') || message.includes('Redirecting') 
              ? 'bg-[rgba(120,190,32,0.1)] text-[#6AAD1C] border border-[rgba(120,190,32,0.3)]' 
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {message}
          </div>
        )}

        {/* Verification Form */}
        <div className="space-y-6">
          <Input
            label="Verification Code"
            type="text"
            id="code"
            placeholder="Enter 6-digit code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />

          <Button onClick={handleVerify} disabled={loading}>
            {loading ? 'Verifying...' : 'Verify Account'}
          </Button>

          <Button onClick={handleResend} variant="secondary" disabled={loading}>
            Resend Code
          </Button>
        </div>

        {/* Back to Login Link */}
        <div className="mt-6 text-center">
          <a
            href="/login"
            className="text-sm font-semibold text-[#f7953f] transition-colors hover:text-[#E0741C] hover:underline"
          >
            Back to Login
          </a>
        </div>
      </Card>
    </div>
  );
}