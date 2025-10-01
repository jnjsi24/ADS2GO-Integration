import React, { useState } from "react";
import { gql, useMutation } from "@apollo/client";
import { Eye, EyeOff } from "lucide-react";

const REQUEST_PASSWORD_RESET = gql`
  mutation RequestPasswordReset($email: String!) {
    requestPasswordReset(email: $email)
  }
`;

const RESET_PASSWORD = gql`
  mutation ResetPassword($token: String!, $newPassword: String!) {
    resetPassword(token: $token, newPassword: $newPassword)
  }
`;

const ForgotPass: React.FC = () => {
  const [step, setStep] = useState<"request" | "reset">("request");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [requestPasswordReset, { loading: requesting }] = useMutation(
    REQUEST_PASSWORD_RESET,
    {
      onCompleted: () => setStep("reset"),
      onError: () => setError("Failed to send reset email. Please try again."),
    }
  );

  const [resetPassword, { loading: resetting }] = useMutation(RESET_PASSWORD, {
    onCompleted: () =>
      setSuccessMessage("Password reset successful! You can now log in."),
    onError: () =>
      setError("Failed to reset password. Please check your token and try again."),
  });

  const handleRequestSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    await requestPasswordReset({ variables: { email } });
  };

  const handleResetSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    await resetPassword({ variables: { token, newPassword } });
  };

  return (
    <div
      className="relative flex items-center justify-center min-h-screen bg-cover bg-center"
      style={{ backgroundImage: "url('/image/login.png')" }}
    >
      {/* Overlay for better contrast */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-lg" />

      {/* Centered Form */}
      <div className="relative z-10 w-full max-w-md px-8 py-10 bg-white/40 rounded-xl shadow-2xl">
        <h2 className="text-3xl font-bold text-center text-white mb-4">
          {step === "request" ? "Forgot Password" : "Reset Password"}
        </h2>
        <p className="text-center text-gray-200 mb-6">
          {step === "request"
            ? "We'll email you a reset token to change your password."
            : "Enter the token from your email and your new password."}
        </p>

        {successMessage ? (
          <div className="text-green-500 text-sm mb-6 text-center font-semibold">
            {successMessage}
          </div>
        ) : step === "request" ? (
          <form onSubmit={handleRequestSubmit} className="space-y-6">
            <div className="relative">
              <input
                type="email"
                id="email"
                placeholder=" "
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className={`peer w-full px-0 text-white pt-5 pb-2 border-b bg-transparent focus:outline-none ${
                  error ? "border-red-400" : "border-gray-300"
                }`}
                style={{ backgroundColor: "transparent" }}
              />
              <label
                htmlFor="email"
                className={`absolute left-0 text-black bg-transparent transition-all duration-200 ${email
                  ? '-top-2 text-sm text-black/70 font-bold'
                  : 'peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-placeholder-shown:text-white'} peer-focus:-top-2 peer-focus:text-sm peer-focus:text-black/70 peer-focus:font-bold`}
              >
                Enter your email
              </label>
              {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-semibold transition"
              disabled={requesting}
            >
              {requesting ? "Sending..." : "Send Reset Token"}
            </button>
          </form>

        ) : (
          <form onSubmit={handleResetSubmit} className="space-y-6">
            <div className="relative">
              <input
                type="text"
                id="resetToken"
                placeholder=" "
                required
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className={`peer w-full text-white px-0 pt-5 pb-2 border-b bg-transparent focus:outline-none ${
                  error ? "border-red-400" : "border-gray-300"
                }`}
                style={{ backgroundColor: "transparent" }}
              />
              <label
                htmlFor="resetToken"
                className={`absolute left-0 text-black bg-transparent transition-all duration-200 ${token
                  ? '-top-2 text-sm text-black/70 font-bold'
                  : 'peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-placeholder-shown:text-white'} peer-focus:-top-2 peer-focus:text-sm peer-focus:text-black/70 peer-focus:font-bold`}
              >
                Reset Token
              </label>
            </div>

            {/* 🔒 New Password with Toggle + Floating Label */}
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                id="newPassword"
                placeholder=" "
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={`peer w-full text-white px-0 pt-5 pb-2 pr-10 border-b bg-transparent focus:outline-none ${
                  error ? "border-red-400" : "border-gray-300"
                }`}
                style={{ backgroundColor: "transparent" }}
              />
              <label
                htmlFor="newPassword"
                className={`absolute left-0 text-black bg-transparent transition-all duration-200 ${newPassword
                  ? '-top-2 text-sm text-black/70 font-bold'
                  : 'peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-placeholder-shown:text-white'} peer-focus:-top-2 peer-focus:text-sm peer-focus:text-black/70 peer-focus:font-bold`}
              >
                New Password
              </label>

              <button
                type="button"
                className="absolute inset-y-0 right-0 flex items-center pr-2 text-white"
                onClick={() => setShowPassword((prev) => !prev)}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold transition"
              disabled={resetting}
            >
              {resetting ? "Resetting..." : "Reset Password"}
            </button>
          </form>

        )}

        <a
          href="/login"
          className="mt-10 block text-center text-white/60 hover:text-white/90 text-sm font-medium"
        >
          ← Go back to login
        </a>
      </div>
    </div>
  );
};

export default ForgotPass;
