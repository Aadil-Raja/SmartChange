import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

export default function ForgotPassword() {
  const { requestPasswordReset, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');

    const result = await requestPasswordReset(email);
    
    if (result.success) {
      setMessage(result.message || 'Reset link sent to your email');
      // Note: In production, backend sends email with token
      // For dev, check backend response for reset link
    } else {
      setMessage(result.message || 'Failed to send reset link');
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
            Forgot Password?
          </h1>
          <p className="text-sm text-gray-600 font-medium">
            Enter your email address and we'll send you a link to reset your password
          </p>
        </div>

        {message && (
          <div className={`mb-4 rounded-lg p-3 text-center text-sm ${
            message.includes('sent') ? 'bg-[rgba(120,190,32,0.1)] text-[#6AAD1C] border border-[rgba(120,190,32,0.3)]' : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {message}
          </div>
        )}

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

          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Sending...' : 'Send Reset Link'}
          </Button>
        </div>

        <div className="mt-6 text-center">
          <a
            href="/login"
            className="text-sm font-semibold text-[#F58220] transition-colors hover:text-[#E0741C] hover:underline"
          >
            Back to Login
          </a>
        </div>
      </Card>
    </div>
  );
}