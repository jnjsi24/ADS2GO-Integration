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
    <div className="relative min-h-screen flex items-center bg-[#fdfdfd] justify-center">
      {/* Video Background */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[70vw] h-auto object-cover"
      >
        <source src="/image/forgot.mp4" type="video/mp4" />
        Your browser does not support the video tag.
      </video>
      
      {/* Dark overlay for video */}
      <div className="absolute inset-0 "></div>
      
      {/* Form Container */}
      <div className="absolute top-44 mr-44 z-10 max-w-md w-full p-6 text-center bg-none">
        <h2 className="text-4xl font-semibold text-gray-200 mb-4 mt-2">
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
              className="w-full px-4 py-3 border border-gray-800 rounded-xl shadow-lg focus:outline-none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              type="submit"
              className="w-full bg-[#FF9800] text-white py-3 rounded-lg hover:bg-[#FF9B45] transition"
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
              className="w-full px-4 py-3 border border-gray-800 rounded-xl shadow-lg focus:outline-none"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="New Password"
              className="w-full px-4 py-3 border border-gray-800 rounded-xl shadow-lg focus:outline-none"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              type="submit"
              className="w-full bg-[#FF9800] text-white py-3 rounded-lg hover:bg-[#FF9B45] transition"
              disabled={resetting}
            >
              {resetting ? "Resetting..." : "Reset Password"}
            </button>
          </form>
        )}

        <a
          href="/login"
          className="mt-6 inline-block text-blue-600 ml-1 hover:underline text-sm"
        >
          ← Go back to login
        </a>
      </div>
    </div>
  );
};

export default ForgotPass;