import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    // Normally call backend API to send reset link
    console.log('Reset link sent to:', email);
    // For now, navigate directly to reset page with dummy token
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-4 py-8">
      <Card className="w-full max-w-md p-8">
        {/* Logo */}
        <div className="mb-6 flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[#FDB913] to-[#F58220] shadow-lg">
            <span className="text-3xl font-bold text-white">KE</span>
          </div>
        </div>

        {/* Title & Description */}
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold text-[#333333]">Forgot Password?</h1>
          <p className="text-sm text-gray-600">
            Enter your email address and we'll send you a link to reset your password
          </p>
        </div>

        {/* Form */}
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

          <Button onClick={handleSubmit} type="submit">
            Send Reset Link
          </Button>
        </div>

        {/* Back to Login Link */}
        <div className="mt-6 text-center">
          <a
            href="/login"
            className="text-sm font-medium text-[#F58220] transition-colors hover:text-[#FDB913] hover:underline"
          >
            Back to Login
          </a>
        </div>
      </Card>
    </div>
  );
};

export default ForgotPassword;