import React, { useState } from 'react';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    console.log('Login attempt:', { email, password });
    // Add your login logic here
  };

  return (
    <div className="bg-red-500 text-white p-10 text-4xl"></div>,
    <div className=" flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-4 py-8">
      <Card className="w-full max-w-md p-8">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[#FDB913] to-[#F58220] shadow-lg">
            <span className="text-3xl font-bold text-white">KE</span>
          </div>
        </div>

        {/* Title & Subtitle */}
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold text-[#333333]">KE Smart Change</h1>
          <p className="text-sm text-gray-600">Sign in to continue</p>
        </div>

        {/* Login Inputs */}
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

          <Button onClick={handleSubmit}>
            Sign In
          </Button>
        <div className="mt-6 text-center">
          <span className="text-sm text-gray-600">Don't have an account? </span>
          <a
            href="/signup"
            className="text-sm font-medium text-[#F58220] transition-colors hover:text-[#FDB913] hover:underline"
          >
            Signup
          </a>
        </div>
        </div>

        {/* Forgot Password Link */}
        <div className="mt-6 text-center">
          <a
            href="/forgot-password"
            className="text-sm font-medium text-[#F58220] transition-colors hover:text-[#FDB913] hover:underline"
          >
            Forgot Password?
          </a>
        </div>
      </Card>
    </div>
  );
};

export default Login;