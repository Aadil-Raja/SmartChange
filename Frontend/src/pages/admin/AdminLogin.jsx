import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAdminAuth } from "../../hooks/useAdminAuth";


export default function AdminLogin() {
  const { login, loading, error } = useAdminAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
    const [message, setMessage] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = await login(email, password);
    if (res.success) {
        setMessage('Login successful!');
        setTimeout(() => (window.location.href = '/admin'), 1500);
        return;
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-yellow-50 via-orange-50 to-white px-4 py-8">
      <div className="w-full max-w-md rounded-xl bg-white/95 backdrop-blur-sm p-8 shadow-2xl border-0">
        <div className="mb-8 flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[#FDB913] to-[#F58220] shadow-xl">
            <span className="text-3xl font-bold text-white">KE</span>
          </div>
        </div>

        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold bg-gradient-to-r from-[#FDB913] to-[#F58220] bg-clip-text text-transparent">Admin Login</h1>
          <p className="text-sm text-gray-600 font-medium">Sign in to continue</p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-100 p-3 text-center text-sm text-red-800">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
              className="w-full rounded-md border border-gray-300 px-4 py-2.5 text-sm transition-colors focus:border-[#F58220] focus:outline-none focus:ring-2 focus:ring-[#F58220] focus:ring-opacity-20"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-2 block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              className="w-full rounded-md border border-gray-300 px-4 py-2.5 text-sm transition-colors focus:border-[#F58220] focus:outline-none focus:ring-2 focus:ring-[#F58220] focus:ring-opacity-20"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-gradient-to-r from-[#FDB913] to-[#F58220] px-4 py-2.5 font-medium text-white transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}