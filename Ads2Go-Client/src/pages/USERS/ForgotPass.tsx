import React, { useState } from "react";
import { gql, useMutation } from "@apollo/client";

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

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [requestPasswordReset, { loading: requesting }] = useMutation(REQUEST_PASSWORD_RESET, {
    onCompleted: () => setStep("reset"),
    onError: () => setError("Failed to send reset email. Please try again."),
  });

  const [resetPassword, { loading: resetting }] = useMutation(RESET_PASSWORD, {
    onCompleted: () => setSuccessMessage("Password reset successful! You can now log in."),
    onError: () => setError("Failed to reset password. Please check your token and try again."),
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-gray-100 px-4">
      <div className="max-w-md w-full p-6 text-center">
        <img src="/image/blue-logo.png" alt="Logo" className="mx-auto mb-4 w-20 h-auto" />
        <h2 className="text-3xl font-semibold text-gray-800 mb-4">
          {step === "request" ? "Forgot Password" : "Reset Password"}
        </h2>
        <p className="text-gray-500 mb-6">
          {step === "request"
            ? "We'll email you a reset token to change your password."
            : "Enter the token from your email and your new password."}
        </p>

        {successMessage ? (
          <div className="text-green-600 text-sm mb-6">{successMessage}</div>
        ) : step === "request" ? (
          <form onSubmit={handleRequestSubmit} className="space-y-6">
            <input
              type="email"
              placeholder="Email"
              className="w-full px-4 py-3 border border-gray-200 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              type="submit"
              className="w-full bg-teal-500 text-white py-3 rounded-lg hover:bg-teal-400 transition"
              disabled={requesting}
            >
              {requesting ? "Sending..." : "Send Reset Token"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleResetSubmit} className="space-y-6">
            <input
              type="text"
              placeholder="Reset Token"
              className="w-full px-4 py-3 border border-gray-200 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="New Password"
              className="w-full px-4 py-3 border border-gray-200 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              type="submit"
              className="w-full bg-teal-500 text-white py-3 rounded-lg hover:bg-teal-400 transition"
              disabled={resetting}
            >
              {resetting ? "Resetting..." : "Reset Password"}
            </button>
          </form>
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