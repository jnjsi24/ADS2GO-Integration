import React, { useState } from "react";
import { useMutation, gql } from "@apollo/client";
import { X, ChevronDown } from "lucide-react";
import { useToast, ToastContainer } from "../../components/ToastNotification";

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
    adStatus?: string; // Ad approval status
    receiptId?: string; // Present when already paid
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
  const { toasts, addToast, removeToast } = useToast();
  const [createPayment, { loading }] = useMutation(CREATE_PAYMENT, {
    // Refetch the query used in PaymentHistory to reflect DB changes
    refetchQueries: ["GetUserAdsWithPayments"],
  });
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
    addToast({
      type: 'error',
      title: 'Error!',
      message: msg,
      duration: 5000
    });
  };

  const showSuccess = (msg: string) => {
    addToast({
      type: 'success',
      title: 'Success!',
      message: msg,
      duration: 5000
    });
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
  
  // Check if ad is approved and payment status is pending
  if (paymentItem.adStatus !== 'APPROVED' || paymentItem.status !== 'PENDING') {
    showError("⚠️ Ad must be approved and payment must be pending before you can make a payment.");
    return;
  }
  
  if (!selectedMethod) {
    showError("Please select a payment method");
    return;
  }

  // ============ 🔍 VALIDATION RULES ============ //
  const nameRegex = /^[A-Za-z\s]+$/; // only letters + spaces
  const numberOnly = /^[0-9]+$/;
  const cardNumberRegex = /^[0-9]{16,19}$/;
  const cvvRegex = /^[0-9]{3,4}$/;
  const expiryRegex = /^(0[1-9]|1[0-2])\/([0-9]{2})$/; // MM/YY
  const gcashPaypalNumberRegex = /^09\d{9}$/; // starts with 09 + 11 digits

  // ============ CREDIT CARD VALIDATION ============ //
  if (selectedMethod === "CREDIT_CARD") {
    if (!cardNumber || !cardHolder || !expiry || !cvv) {
      showError("Please complete all credit card fields");
      return;
    }
    if (!cardNumberRegex.test(cardNumber)) {
      showError("Card number must be 16–19 digits only (no letters or symbols)");
      return;
    }
    if (!nameRegex.test(cardHolder)) {
      showError("Card holder name must contain only letters");
      return;
    }
    if (!expiryRegex.test(expiry)) {
      showError("Expiry date must be in MM/YY format");
      return;
    }
    if (!cvvRegex.test(cvv)) {
      showError("CVV must be 3–4 digits only");
      return;
    }
  }

  // ============ GCASH VALIDATION ============ //
  if (selectedMethod === "GCASH") {
    if (!gcashNumber || !gcashName) {
      showError("Please complete all GCash fields");
      return;
    }
    if (!gcashPaypalNumberRegex.test(gcashNumber)) {
      showError("GCash number must start with 09 and be 11 digits");
      return;
    }
    if (!nameRegex.test(gcashName)) {
      showError("GCash registered name must contain only letters");
      return;
    }
  }

  // ============ PAYPAL VALIDATION ============ //
  if (selectedMethod === "PAYPAL") {
    if (!paypalNumber || !paypalName) {
      showError("Please complete all PayPal fields");
      return;
    }
    if (!gcashPaypalNumberRegex.test(paypalNumber)) {
      showError("PayPal number must start with 09 and be 11 digits");
      return;
    }
    if (!nameRegex.test(paypalName)) {
      showError("PayPal registered name must contain only letters");
      return;
    }
  }

  // ============ BANK TRANSFER VALIDATION ============ //
  if (selectedMethod === "BANK_TRANSFER") {
    if (!bankName || !bankAccountName || !bankAccountNumber) {
      showError("Please complete all bank transfer fields");
      return;
    }
    if (!nameRegex.test(bankAccountName)) {
      showError("Account name must contain only letters");
      return;
    }
    if (!numberOnly.test(bankAccountNumber)) {
      showError("Account number must contain digits only");
      return;
    }
  }

  // ============ CASH VALIDATION ============ //
  if (selectedMethod === "CASH") {
    showError("Cash payments must be completed in person at 123 Main Street, Manila.");
    return;
  }

  // ✅ All validation passed
  setIsProcessing(true);

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
      setTimeout(onClose, 2000);
    } else {
      showError(data?.createPayment?.message || "Payment failed.");
    }
  } catch (err: any) {
    const msg = err.message || "Unknown error";
    if (msg.includes("Ad must be approved first") || msg.includes("Ad is not approved")) {
      showError("⚠️ Ad must be approved first before you can make a payment.");
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
  <div className="fixed inset-0 z-[60] bg-black bg-opacity-50 flex items-center justify-center p-2 md:p-4">
    <div className={`bg-white rounded-md shadow-xl w-full max-w-[92vw] ${isPending ? "md:max-w-4xl" : "md:max-w-lg"} p-4 md:p-8 relative max-h-[90vh] overflow-y-auto`}>
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
      >
        <X size={24} />
      </button>

      {/* Desktop View */}
      <div className="hidden md:block">
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
                  className="w-full flex justify-between items-center border shadow-md rounded-md px-4 py-2 text-sm bg-white focus:outline-none"
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
                  <div className="absolute z-10 mt-1 w-full bg-white border shadow-md rounded-md">
                    {methods.map((method) => (
                      <div
                        key={method.value}
                        onClick={() => {
                          setSelectedMethod(method.value);
                          setIsDropdownOpen(false);
                        }}
                        className={`px-4 py-2 text-sm cursor-pointer hover:bg-gray-100 ${
                          selectedMethod === method.value ? "bg-gray-100" : ""
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
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, ""); // remove non-digits
                      if (value.length <= 19) setCardNumber(value);
                    }}
                    type="text"
                    placeholder="Card Number"
                    className="w-full border rounded-md shadow-md px-4 py-2 text-sm focus:outline-none"
                  />
                  <input
                    value={cardHolder}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^A-Za-z\s]/g, ""); // letters + spaces only
                      setCardHolder(value);
                    }}
                    type="text"
                    placeholder="Card Holder Name"
                    className="w-full border rounded-md shadow-md px-4 py-2 text-sm focus:outline-none"
                  />
                  <div className="flex gap-3">
                    <input
                      value={expiry}
                       onChange={(e) => {
                        // Allow MM/YY format only
                        const value = e.target.value.replace(/[^0-9/]/g, "");
                        setExpiry(value);
                      }}
                      type="text"
                      placeholder="Expiry (MM/YY)"
                      className="flex-1 border rounded-md px-4 shadow-md py-2 text-sm focus:outline-none"
                    />
                    <input
                      value={cvv}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, ""); // digits only
                        if (value.length <= 4) setCvv(value);
                      }}
                      type="text"
                      placeholder="CVV"
                      className="w-24 border rounded-md shadow-md px-4 py-2 text-sm focus:outline-none"
                    />
                  </div>
                </div>
              )}
              {selectedMethod === "GCASH" && (
                <div className="space-y-3">
                  <input
                    value={gcashNumber}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, ""); // digits only
                      if (value.length <= 11) setGcashNumber(value);
                    }}
                    type="text"
                    placeholder="GCash Mobile Number"
                    className="w-full border rounded-md shadow-md px-4 py-2 text-sm focus:outline-none"
                  />
                  <input
                    value={gcashName}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^A-Za-z\s]/g, ""); // letters + spaces only
                      setGcashName(value);
                    }}
                    type="text"
                    placeholder="Registered Name"
                    className="w-full border rounded-md shadow-md px-4 py-2 text-sm focus:outline-none"
                  />
                </div>
              )}
              {selectedMethod === "PAYPAL" && (
                <div className="space-y-3">
                  <input
                    value={paypalNumber}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, ""); // digits only
                      if (value.length <= 11) setPaypalNumber(value);
                    }}
                    type="text"
                    placeholder="Paypal Mobile Number"
                    className="w-full border rounded-md shadow-md px-4 py-2 text-sm focus:outline-none"
                  />
                  <input
                    value={paypalName}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^A-Za-z\s]/g, "");
                      setPaypalName(value);
                    }}
                    type="text"
                    placeholder="Registered Name"
                    className="w-full border rounded-md shadow-md px-4 py-2 text-sm focus:outline-none"
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
                    className="w-full border rounded-md shadow-md px-4 py-2 text-sm focus:outline-none"
                  />
                  <input
                    value={bankAccountName}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^A-Za-z\s]/g, ""); // only letters + spaces
                      setBankAccountName(value);
                    }}
                    type="text"
                    placeholder="Account Name"
                    className="w-full border rounded-md shadow-md px-4 py-2 text-sm focus:outline-none"
                  />
                  <input
                    value={bankAccountNumber}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, ""); // only digits
                      if (value.length <= 16) setBankAccountNumber(value);
                    }}
                    type="text"
                    placeholder="Account Number"
                    className="w-full border rounded-md shadow-md px-4 py-2 text-sm focus:outline-none"
                  />
                </div>
              )}
              {selectedMethod === "CASH" && (
                <div className="mt-4 p-3 border text-sm text-gray-700">
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
            <table className="w-full text-sm shadow-md rounded-lg mt-5 p-4">
              <tbody className="divide-y">
                <tr>
                  <td className="py-2 px-4 text-gray-600">Mode of Payment</td>
                  <td className="py-2 px-4 text-gray-800 font-medium">
                    {paymentType || "N/A"}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 px-4 text-gray-600">Ad Type</td>
                  <td className="py-2 px-4 text-gray-800 font-medium">
                    {paymentItem.adType || "N/A"}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 px-4 text-gray-600">Duration</td>
                  <td className="py-2 px-4 text-gray-800 font-medium">
                    {paymentItem.durationDays} days
                  </td>
                </tr>
                <tr>
                  <td className="py-2 px-4 text-gray-600">Ad Format</td>
                  <td className="py-2 px-4 text-gray-800 font-medium">
                    {paymentItem.adFormat || "N/A"}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 px-4 text-gray-600">Ad Length</td>
                  <td className="py-2 px-4 text-gray-800 font-medium">
                    {paymentItem.adLengthSeconds} seconds
                  </td>
                </tr>
                {/* Receipt ID - Only show when payment is PAID */}
                {!isPending && paymentItem.receiptId && (
                  <tr>
                    <td className="py-2 px-4 text-gray-600">Receipt ID</td>
                    <td className="py-2 px-4 text-gray-800 font-medium">
                      {paymentItem.receiptId}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {isPending && (
              <div className="mt-6 flex justify-between text-base font-semibold">
                <span>Due today</span>
                <span className="text-gray-900 font-bold text-xl">
                  ₱{parseFloat(paymentItem.totalPrice.replace("$", "")).toFixed(2)}
                </span>
              </div>
            )}
            
            {/* Approval Status Warning */}
            {paymentItem.adStatus !== 'APPROVED' && isPending && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-red-500 text-xl">🚫</span>
                  <div>
                    <p className="text-sm font-semibold text-red-800">
                      Payment Not Available
                    </p>
                    <p className="text-sm text-red-700 mt-1">
                      Your ad must be approved by an admin before you can proceed with payment.
                    </p>
                    <p className="text-xs text-red-600 mt-2">
                      Status: {paymentItem.adStatus === 'PENDING' ? 'Awaiting Admin Approval' : 
                              paymentItem.adStatus === 'RUNNING' ? 'Already Paid and Running' : 
                              'Ad Not Approved'}
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Pay Now Button (Only show for Pending status, non-CASH, and approved ads) */}
            {isPending && selectedMethod !== "CASH" && paymentItem.adStatus === 'APPROVED' && (
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
      </div>

      {/* Mobile View */}
      <div className="block md:hidden">
        <div className="space-y-6 max-h-[60vh] overflow-y-auto">
          {/* Payment Details - Always show */}
          <div>
            <h3 className="text-2xl font-bold text-gray-700 mb-2">
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
            <div className="w-full text-sm shadow-md rounded-md mt-5 p-4">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Mode of Payment</span>
                  <span className="text-gray-800 font-medium">{paymentType || "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Ad Type</span>
                  <span className="text-gray-800 font-medium">{paymentItem.adType || "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Duration</span>
                  <span className="text-gray-800 font-medium">{paymentItem.durationDays} days</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Ad Format</span>
                  <span className="text-gray-800 font-medium">{paymentItem.adFormat || "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Ad Length</span>
                  <span className="text-gray-800 font-medium">{paymentItem.adLengthSeconds} seconds</span>
                </div>
                {/* Receipt ID - Only show when payment is PAID */}
                {!isPending && paymentItem.receiptId && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Receipt ID</span>
                    <span className="text-gray-800 font-medium">{paymentItem.receiptId}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Payment Method (Only show for Pending status) */}
          {isPending && (
            <div className="border-t pt-6">
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
                  className="w-full flex justify-between items-center border shadow-md rounded-md px-4 py-2 text-sm bg-white focus:outline-none"
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
                  <div className="absolute z-10 mt-1 w-full bg-white border shadow-md rounded-md">
                    {methods.map((method) => (
                      <div
                        key={method.value}
                        onClick={() => {
                          setSelectedMethod(method.value);
                          setIsDropdownOpen(false);
                        }}
                        className={`px-4 py-2 text-sm cursor-pointer hover:bg-gray-100 ${
                          selectedMethod === method.value ? "bg-gray-100" : ""
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
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, "");
                      if (value.length <= 19) setCardNumber(value);
                    }}
                    type="text"
                    placeholder="Card Number"
                    className="w-full border rounded-md shadow-md px-4 py-2 text-sm focus:outline-none"
                  />
                  <input
                    value={cardHolder}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^A-Za-z\s]/g, "");
                      setCardHolder(value);
                    }}
                    type="text"
                    placeholder="Card Holder Name"
                    className="w-full border rounded-md shadow-md px-4 py-2 text-sm focus:outline-none"
                  />
                  <div className="flex gap-3">
                    <input
                      value={expiry}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^0-9/]/g, "");
                        setExpiry(value);
                      }}
                      type="text"
                      placeholder="Expiry (MM/YY)"
                      className="flex-1 border rounded-md px-4 shadow-md py-2 text-sm focus:outline-none"
                    />
                    <input
                      value={cvv}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, "");
                        if (value.length <= 4) setCvv(value);
                      }}
                      type="text"
                      placeholder="CVV"
                      className="w-24 border rounded-md shadow-md px-4 py-2 text-sm focus:outline-none"
                    />
                  </div>
                </div>
              )}
              {selectedMethod === "GCASH" && (
                <div className="space-y-3">
                  <input
                    value={gcashNumber}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, "");
                      if (value.length <= 11) setGcashNumber(value);
                    }}
                    type="text"
                    placeholder="GCash Mobile Number"
                    className="w-full border rounded-md shadow-md px-4 py-2 text-sm focus:outline-none"
                  />
                  <input
                    value={gcashName}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^A-Za-z\s]/g, "");
                      setGcashName(value);
                    }}
                    type="text"
                    placeholder="Registered Name"
                    className="w-full border rounded-md shadow-md px-4 py-2 text-sm focus:outline-none"
                  />
                </div>
              )}
              {selectedMethod === "PAYPAL" && (
                <div className="space-y-3">
                  <input
                    value={paypalNumber}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, "");
                      if (value.length <= 11) setPaypalNumber(value);
                    }}
                    type="text"
                    placeholder="Paypal Mobile Number"
                    className="w-full border rounded-md shadow-md px-4 py-2 text-sm focus:outline-none"
                  />
                  <input
                    value={paypalName}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^A-Za-z\s]/g, "");
                      setPaypalName(value);
                    }}
                    type="text"
                    placeholder="Registered Name"
                    className="w-full border rounded-md shadow-md px-4 py-2 text-sm focus:outline-none"
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
                    className="w-full border rounded-md shadow-md px-4 py-2 text-sm focus:outline-none"
                  />
                  <input
                    value={bankAccountName}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^A-Za-z\s]/g, "");
                      setBankAccountName(value);
                    }}
                    type="text"
                    placeholder="Account Name"
                    className="w-full border rounded-md shadow-md px-4 py-2 text-sm focus:outline-none"
                  />
                  <input
                    value={bankAccountNumber}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, "");
                      if (value.length <= 16) setBankAccountNumber(value);
                    }}
                    type="text"
                    placeholder="Account Number"
                    className="w-full border rounded-md shadow-md px-4 py-2 text-sm focus:outline-none"
                  />
                </div>
              )}
              {selectedMethod === "CASH" && (
                <div className="mt-4 p-3 border text-sm text-gray-700">
                  Please go to <strong>123 Main Street, Manila</strong> to complete your payment.
                </div>
              )}
            </div>
          )}

          {/* Mobile-specific layout continues... */}
          {isPending && (
            <div className="mt-6 flex justify-between text-base font-semibold">
              <span>Due today</span>
              <span className="text-gray-900 font-bold text-xl">
                ₱{parseFloat(paymentItem.totalPrice.replace("$", "")).toFixed(2)}
              </span>
            </div>
          )}
          
          {/* Approval Status Warning */}
          {paymentItem.adStatus !== 'APPROVED' && isPending && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-sm text-yellow-800 flex items-center gap-2">
                <span className="text-yellow-500">⚠️</span>
                <span><strong>Ad pending approval:</strong> Your ad must be approved by an admin before payment can be processed.</span>
              </p>
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
            <div className={`mt-6 p-2 rounded-md text-center ${paymentItem.status === "PAID" ? "" : "bg-red-100 text-red-500"}`}>
              <p className="font-medium">
                {paymentItem.status === "PAID"
                  ? ""
                  : "This payment has failed. Please contact support."}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  </div>
);
};

export default Payment;