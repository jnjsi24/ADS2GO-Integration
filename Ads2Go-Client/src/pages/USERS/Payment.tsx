import React, { useState } from "react";
import { useMutation, gql } from "@apollo/client";
import { X, ChevronDown } from "lucide-react";

// Define Status type to match backend PaymentStatus enum
type Status = "PAID" | "PENDING" | "FAILED";

interface PaymentProps {
  paymentItem: {
    id: string; // Maps to adsId
    productName: string;
    amount: string;
    totalPrice: string;
    paymentType?: string;
    adType?: string;
    durationDays: number;
    adFormat?: string;
    adLengthSeconds: number;
    status: Status;
  };
  paymentType: string;
  onClose: () => void;
  onSuccess?: () => void;
}

const CREATE_PAYMENT = gql`
  mutation CreatePayment($input: CreatePaymentInput!) {
    createPayment(input: $input) {
      success
      message
      payment {
        id
        amount
        paymentStatus
        paymentType
        receiptId
      }
    }
  }
`;

const Payment: React.FC<PaymentProps> = ({
  paymentItem,
  paymentType,
  onClose,
  onSuccess,
}) => {
  const [createPayment, { loading }] = useMutation(CREATE_PAYMENT, {
    // Refetch the query used in PaymentHistory to reflect DB changes
    refetchQueries: ["GetUserAdsWithPayments"],
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedMethod, setSelectedMethod] = useState(paymentType || "CREDIT_CARD");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pos, setPos] = useState({ x: 50, y: 50 });

  // Extra field states (for frontend validation only; not sent to backend)
  const [cardNumber, setCardNumber] = useState("");
  const [cardHolder, setCardHolder] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [gcashNumber, setGcashNumber] = useState("");
  const [gcashName, setGcashName] = useState("");
  const [paypalName, setPaypalName] = useState("");
  const [paypalNumber, setPaypalNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAccountName, setBankAccountName] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");

  const methods = [
    { value: "CREDIT_CARD", label: "Credit Card" },
    { value: "GCASH", label: "GCash" },
    { value: "PAYPAL", label: "PayPal" },
    { value: "BANK_TRANSFER", label: "Bank Transfer" },
    { value: "CASH", label: "Cash" },
  ];

  const showError = (msg: string) => {
    setErrorMessage(msg);
    setSuccessMessage(null);
    setTimeout(() => setErrorMessage(null), 5000);
  };

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setErrorMessage(null);
    setTimeout(() => setSuccessMessage(null), 5000);
  };

  const getStatusStyle = (status: Status) => {
    switch (status) {
      case "PAID":
        return "bg-green-200 text-green-700";
      case "PENDING":
        return "bg-yellow-200 text-yellow-700";
      case "FAILED":
        return "bg-red-300 text-red-800";
      default:
        return "";
    }
  };

  const handlePayNow = async () => {
    if (isProcessing || loading) return;
    if (!selectedMethod) {
      showError("Please select a payment method");
      return;
    }
    // Validate fields (frontend only)
    if (selectedMethod === "CREDIT_CARD" && (!cardNumber || !cardHolder || !expiry || !cvv)) {
      showError("Please complete all credit card fields");
      return;
    }
    if (selectedMethod === "GCASH" && (!gcashNumber || !gcashName)) {
      showError("Please complete all GCash fields");
      return;
    }
    if (selectedMethod === "PAYPAL" && (!paypalNumber || !paypalName)) {
      showError("Please complete all PayPal fields");
      return;
    }
    if (selectedMethod === "BANK_TRANSFER" && (!bankName || !bankAccountName || !bankAccountNumber)) {
      showError("Please complete all bank transfer fields");
      return;
    }
    if (selectedMethod === "CASH") {
      showError("Cash payments must be completed in person at 123 Main Street, Manila.");
      return; // Don't call mutation for CASH (handle manually if needed)
    }

    setIsProcessing(true);

    // Input matches CreatePaymentInput (no receiptId)
    const input = {
      adsId: paymentItem.id,
      paymentType: selectedMethod,
      paymentDate: new Date().toISOString(),
    };

    try {
      const { data } = await createPayment({ variables: { input } });
      if (data?.createPayment?.success) {
        showSuccess(`✅ Payment for ${paymentItem.productName} is now PAID!`);
        onSuccess?.();
        setTimeout(onClose, 2000); // Close after success message
      } else {
        showError(data?.createPayment?.message || "Payment failed.");
      }
    } catch (err: any) {
      const msg = err.message || "Unknown error";
      if (msg.includes("Ad is not approved")) {
        showError("⚠️ This ad is not yet approved.");
      } else if (msg.includes("A payment already exists")) {
        showError("⚠️ A payment already exists for this ad.");
      } else if (msg.includes("You are not authorized")) {
        showError("⚠️ You are not authorized to pay for this ad.");
      } else {
        showError(`❌ Unexpected error: ${msg}`);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const isButtonDisabled = loading || isProcessing;
  const isPending = paymentItem.status === "PENDING";

  return (
    <div className="fixed inset-0 z-[60] bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className={`bg-white rounded-lg shadow-xl p-8 ${isPending ? "w-full max-w-4xl" : "w-96"} relative`}>
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X size={24} />
        </button>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* LEFT: Payment Method (Only show for Pending status) */}
          {isPending && (
            <div className="border-r pr-6">
              <h3 className="text-lg font-semibold text-gray-700 mb-2">
                Select Payment Method
              </h3>
              {/* 🔒 Security Message */}
              <p className="text-sm text-gray-500 mb-4">
                Please provide the required payment details based on your selected method.
                Your information will remain private and securely processed.
              </p>
              {/* Dropdown */}
              <div className="relative mb-4">
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="w-full flex justify-between items-center border rounded-md px-4 py-2 text-sm bg-white focus:outline-none"
                >
                  {methods.find(m => m.value === selectedMethod)?.label || "Choose Method"}
                  <ChevronDown
                    size={18}
                    className={`transition-transform ${
                      isDropdownOpen ? "rotate-180" : "rotate-0"
                    }`}
                  />
                </button>
                {isDropdownOpen && (
                  <div className="absolute z-10 mt-1 w-full bg-white border rounded-md shadow-md">
                    {methods.map((method) => (
                      <div
                        key={method.value}
                        onClick={() => {
                          setSelectedMethod(method.value);
                          setIsDropdownOpen(false);
                        }}
                        className={`px-4 py-2 text-sm cursor-pointer hover:bg-gray-100 ${
                          selectedMethod === method.value ? "bg-orange-50" : ""
                        }`}
                      >
                        {method.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {/* Conditional Inputs */}
              {selectedMethod === "CREDIT_CARD" && (
                <div className="space-y-3">
                  <input
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    type="text"
                    placeholder="Card Number"
                    className="w-full border rounded-md px-4 py-2 text-sm focus:outline-none"
                  />
                  <input
                    value={cardHolder}
                    onChange={(e) => setCardHolder(e.target.value)}
                    type="text"
                    placeholder="Card Holder Name"
                    className="w-full border rounded-md px-4 py-2 text-sm focus:outline-none"
                  />
                  <div className="flex gap-3">
                    <input
                      value={expiry}
                      onChange={(e) => setExpiry(e.target.value)}
                      type="text"
                      placeholder="Expiry (MM/YY)"
                      className="flex-1 border rounded-md px-4 py-2 text-sm focus:outline-none"
                    />
                    <input
                      value={cvv}
                      onChange={(e) => setCvv(e.target.value)}
                      type="text"
                      placeholder="CVV"
                      className="w-24 border rounded-md px-4 py-2 text-sm focus:outline-none"
                    />
                  </div>
                </div>
              )}
              {selectedMethod === "GCASH" && (
                <div className="space-y-3">
                  <input
                    value={gcashNumber}
                    onChange={(e) => setGcashNumber(e.target.value)}
                    type="text"
                    placeholder="GCash Mobile Number"
                    className="w-full border rounded-md px-4 py-2 text-sm focus:outline-none"
                  />
                  <input
                    value={gcashName}
                    onChange={(e) => setGcashName(e.target.value)}
                    type="text"
                    placeholder="Registered Name"
                    className="w-full border rounded-md px-4 py-2 text-sm focus:outline-none"
                  />
                </div>
              )}
              {selectedMethod === "PAYPAL" && (
                <div className="space-y-3">
                  <input
                    value={paypalNumber}
                    onChange={(e) => setPaypalNumber(e.target.value)}
                    type="text"
                    placeholder="Paypal Mobile Number"
                    className="w-full border rounded-md px-4 py-2 text-sm focus:outline-none"
                  />
                  <input
                    value={paypalName}
                    onChange={(e) => setPaypalName(e.target.value)}
                    type="text"
                    placeholder="Registered Name"
                    className="w-full border rounded-md px-4 py-2 text-sm focus:outline-none"
                  />
                </div>
              )}
              {selectedMethod === "BANK_TRANSFER" && (
                <div className="space-y-3">
                  <input
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    type="text"
                    placeholder="Bank Name"
                    className="w-full border rounded-md px-4 py-2 text-sm focus:outline-none"
                  />
                  <input
                    value={bankAccountName}
                    onChange={(e) => setBankAccountName(e.target.value)}
                    type="text"
                    placeholder="Account Name"
                    className="w-full border rounded-md px-4 py-2 text-sm focus:outline-none"
                  />
                  <input
                    value={bankAccountNumber}
                    onChange={(e) => setBankAccountNumber(e.target.value)}
                    type="text"
                    placeholder="Account Number"
                    className="w-full border rounded-md px-4 py-2 text-sm focus:outline-none"
                  />
                </div>
              )}
              {selectedMethod === "CASH" && (
                <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-md text-sm text-gray-700">
                  Please go to <strong>123 Main Street, Manila</strong> to complete your payment.
                </div>
              )}
            </div>
          )}
          {/* RIGHT: Payment Details (Always show) */}
          <div className={isPending ? "" : "md:col-span-2"}>
            <h3 className="text-3xl font-bold text-gray-700 mb-2">
              {paymentItem.productName}
            </h3>
            <div className="flex items-center">
              <p className="text-md font-semibold text-gray-900">
                ₱{parseFloat(paymentItem.totalPrice.replace("$", "")).toFixed(2)}
              </p>
              <span className="text-gray-400 mx-2">|</span>
              <span
                className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-medium ${getStatusStyle(
                  paymentItem.status
                )}`}
              >
                {paymentItem.status}
              </span>
            </div>
            <table className="w-full text-sm bg-gray-100 rounded-lg mt-5 p-4">
              <tbody className="divide-y">
                <tr>
                  <td className="py-2 px-4 text-gray-600 font-medium">Price</td>
                  <td className="py-2 px-4 text-gray-800">
                    ₱{parseFloat(paymentItem.totalPrice.replace("$", "")).toFixed(2)}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 px-4 text-gray-600 font-medium">Mode of Payment</td>
                  <td className="py-2 px-4 text-gray-800">
                    {paymentType || "N/A"}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 px-4 text-gray-600 font-medium">Ad Type</td>
                  <td className="py-2 px-4 text-gray-800">
                    {paymentItem.adType || "N/A"}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 px-4 text-gray-600 font-medium">Duration</td>
                  <td className="py-2 px-4 text-gray-800">
                    {paymentItem.durationDays} days
                  </td>
                </tr>
                <tr>
                  <td className="py-2 px-4 text-gray-600 font-medium">Ad Format</td>
                  <td className="py-2 px-4 text-gray-800">
                    {paymentItem.adFormat || "N/A"}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 px-4 text-gray-600 font-medium">Ad Length</td>
                  <td className="py-2 px-4 text-gray-800">
                    {paymentItem.adLengthSeconds} seconds
                  </td>
                </tr>
              </tbody>
            </table>
            {isPending && (
              <div className="mt-6 flex justify-between text-base font-semibold">
                <span>Due today</span>
                <span className="text-gray-900 text-xl">
                  ₱{parseFloat(paymentItem.totalPrice.replace("$", "")).toFixed(2)}
                </span>
              </div>
            )}
            {/* Pay Now Button (Only show for Pending status and non-CASH) */}
            {isPending && selectedMethod !== "CASH" && (
              <div className="flex justify-end">
                <button
                  onClick={handlePayNow}
                  disabled={isButtonDisabled}
                  onMouseMove={(e) => {
                    if (isButtonDisabled) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = ((e.clientX - rect.left) / rect.width) * 100;
                    const y = ((e.clientY - rect.top) / rect.height) * 100;
                    setPos({ x, y });
                  }}
                  className={`relative group inline-flex items-center justify-center overflow-hidden
                              mt-6 py-2 rounded-md font-semibold text-white transition-all duration-300
                              ${isButtonDisabled
                                ? "bg-gray-400 cursor-not-allowed"
                                : "hover:scale-105"
                              }`}
                  style={isButtonDisabled ? {} : {
                    backgroundImage: `linear-gradient(to right, #FFB877 0%, #FF9B45 100%),
                                      radial-gradient(circle at ${pos.x}% ${pos.y}%, rgba(173,216,230,0), rgba(173,216,230,0))`,
                  }}
                >
                  <span className="inline-flex items-center gap-2 px-6">
                    {isProcessing ? "Processing..." : "Pay Now"}
                  </span>
                  {/* Light-blue shine that follows the mouse on hover */}
                  {!isButtonDisabled && (
                    <span
                      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                      style={{
                        background: `radial-gradient(circle at ${pos.x}% ${pos.y}%, rgba(255,255,255,0.25), transparent 60%)`,
                      }}
                    />
                  )}
                </button>
              </div>
            )}
            {/* Show message for Paid/Failed status */}
            {!isPending && (
              <div className={`mt-6 p-2 rounded-lg text-center ${paymentItem.status === "PAID" ? "" : "bg-red-100 text-red-500"}`}>
                <p className="font-medium">
                  {paymentItem.status === "PAID"
                    ? ""
                    : "This payment has failed. Please contact support."}
                </p>
              </div>
            )}
          </div>
        </div>
        {errorMessage && (
          <div className="fixed bottom-5 right-5 w-auto text-center bg-red-200 text-red-500 px-4 py-3 rounded-lg shadow-lg text-sm font-bold animate-slide-right z-[9999]">
            {errorMessage}
          </div>
        )}
        {successMessage && (
          <div className="fixed bottom-5 right-5 w-auto text-center bg-green-500 text-white px-4 py-3 rounded-lg shadow-lg text-sm font-bold animate-slide-right z-[9999]">
            {successMessage}
          </div>
        )}
      </div>
    </div>
  );
};

export default Payment;