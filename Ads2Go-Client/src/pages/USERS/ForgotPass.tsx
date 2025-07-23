import React, { useState } from "react";

const ForgotPass: React.FC = () => {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log("Forgot password request for:", email);
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-gray-100 px-4">
      <div className="max-w-md w-full p-6 text-center">
        <img
          src="/image/blue-logo.png"
          alt="Logo"
          className="mx-auto mb-4 w-20 h-auto"
        />
        <h2 className="text-4xl font-semibold text-gray-800 mb-4">Forget Password</h2>
        <p className="text-gray-500 mb-24">We'll email you a link to reset your password.</p>

        {!submitted ? (
          <form onSubmit={handleSubmit} className="space-y-10">
            <div className="relative">
              <input
                type="email"
                id="email"
                className="w-full px-10 py-3 border border-gray-200 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-400 text-left"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                  <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                </svg>
              </span>
            </div>
            <button
              type="submit"
              className="w-full bg-teal-500 text-white py-3 rounded-lg hover:bg-teal-400 hover:text-gray-600 transition"
            >
              Send an email
            </button>
          </form>
        ) : (
          <div className="text-center text-green-600 text-sm">
            If that email is registered, a reset link has been sent!
          </div>
        )}
        <a
          href="/login"
          className="mt-6 inline-block text-gray-500 hover:text-gray-700 text-sm"
        >
          ← Go back to login
        </a>
      </div>
    </div>
  );
};

export default ForgotPass;