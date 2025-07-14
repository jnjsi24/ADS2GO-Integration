import React, { useState } from 'react';

const AdminLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Logging in with', { email, password });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0A192F] px-4">
      <div className="bg-white rounded-2xl shadow-xl p-12 w-full max-w-xl">
        <div className="text-center mb-10">
          <img
            alt="Ads2Go Logo"
            className="mx-auto my-5 w-32 h-32"
          />
          <h2 className="text-xl font-semibold text-gray-800">Admin Login</h2>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-gray-700 font-semibold mb-2 text-lg">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-6 py-4 rounded-lg bg-[#CBF3F0] text-black placeholder:text-black text-base focus:outline-none"
              placeholder="admin@example.com"
              autoComplete="email"
              required
            />
          </div>
          <div>
            <label className="block text-gray-700 font-semibold mb-2 text-lg">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-6 py-4 rounded-lg bg-[#CBF3F0] text-black placeholder:text-black text-base focus:outline-none"
              placeholder="••••••••••••••••••••"
              autoComplete="current-password"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full py-3 rounded-lg bg-[#0A192F] text-white text-lg font-bold hover:bg-[#091a2c] transition"
          >
            LOGIN
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminLogin;
