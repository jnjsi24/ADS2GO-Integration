import React, { useState } from 'react';
import { useMutation, gql } from '@apollo/client';

interface PaymentProps {
  paymentItem: {
    id: string;
    productName: string;
    amount: string;
  };
  paymentType: string;
  onClose: () => void;
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

const Payment: React.FC<PaymentProps> = ({ paymentItem, paymentType, onClose }) => {
  const [createPayment, { loading }] = useMutation(CREATE_PAYMENT);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handlePayNow = async () => {
    const input = {
      adsId: paymentItem.id,
      paymentType,
      paymentDate: new Date().toISOString(),
      receiptId: `REC-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
    };

    try {
      const { data } = await createPayment({ variables: { input } });
      if (data?.createPayment?.success) {
        alert(`✅ Payment for ${paymentItem.productName} is now PAID!`);
        onClose();
      } else {
        showError(data?.createPayment?.message || "Payment failed.");
      }
    } catch (err: any) {
      const msg = err.message || "";

      if (msg.includes("Ad is not approved")) {
        showError("⚠️ This ad is not yet approved. You can only pay for approved ads.");
      } else if (msg.includes("Ad not found")) {
        showError("❌ The ad you’re trying to pay for was not found.");
      } else if (msg.includes("A payment already exists")) {
        showError("⚠️ A payment already exists for this ad.");
      } else {
        showError("❌ Unexpected error: " + msg);
      }
    }
  };

  const showError = (msg: string) => {
    setErrorMessage(msg);
    setTimeout(() => setErrorMessage(null), 5000); // auto-hide after 5s
  };

  const renderPaymentDetails = () => {
    switch (paymentType) {
      case 'CASH':
        return (
          <div className="fixed bottom-4 right-[400px] bg-white rounded-xl shadow-lg w-80 max-w-sm p-6">
            <div className="flex justify-between items-center mb-4 border-b border-gray-300 pb-2">
              <span className="text-lg font-bold">Cash</span>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="mb-4">
              <div className="flex justify-between items-baseline mb-2">
                <span className="text-xl font-bold">Total Payment</span>
                <span className="text-xl font-bold">
                  P {parseFloat(paymentItem.amount.replace('$', '')).toFixed(2)}
                </span>
              </div>
            </div>
            <button
              className="w-full py-3 bg-[#FF9800] text-white rounded-xl font-semibold hover:bg-[#FF9B45] transition-colors"
              onClick={handlePayNow}
              disabled={loading}
            >
              {loading ? "Processing..." : "Pay"}
            </button>
          </div>
        );

      case 'CREDIT_CARD':
      case 'DEBIT_CARD':
        return (
          <div className="fixed bottom-4 right-[400px] bg-white rounded-xl shadow-lg w-80 max-w-md p-6">
            <div className="flex justify-between items-center mb-4 border-b border-gray-300 pb-2">
              <span className="text-lg font-bold">Card Payment</span>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <p className="text-sm font-semibold text-gray-800 mb-2">
              Total: P {parseFloat(paymentItem.amount.replace('$', '')).toFixed(2)}
            </p>
            <div className="space-y-4">
              <input type="text" placeholder="Card Number" className="w-full border p-2 rounded" />
              <input type="text" placeholder="Card Holder Name" className="w-full border p-2 rounded" />
              <div className="flex space-x-4">
                <input type="text" placeholder="Expiry Date (MM/YY)" className="w-1/2 border p-2 rounded" />
                <input type="text" placeholder="CVV" className="w-1/2 border p-2 rounded" />
              </div>
            </div>
            <button
              className="w-full py-3 bg-[#FF9800] text-white rounded-xl font-semibold hover:bg-[#FF9B45] transition-colors mt-6"
              onClick={handlePayNow}
              disabled={loading}
            >
              {loading ? "Processing..." : "Pay with Card"}
            </button>
          </div>
        );

      case 'GCASH':
        return ( 
          <div className="fixed bottom-4 right-[400px] bg-white rounded-xl shadow-lg w-80 max-w-sm p-6 ">
            <div className="flex justify-between items-center mb-4 border-b border-gray-300 pb-2">
              <span className="text-lg font-bold">GCash Payment</span>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <p className="text-sm font-semibold text-gray-800 mb-2">
              Total: P {parseFloat(paymentItem.amount.replace('$', '')).toFixed(2)}
            </p>
            <p className="text-sm text-gray-600 mb-4">Please enter your GCash mobile number to proceed.</p>
            <input type="text" placeholder="GCash Mobile Number" className="w-full border p-2 rounded" />
            <button
              className="w-full py-3 bg-[#FF9800] text-white rounded-xl font-semibold hover:bg-[#FF9B45] transition-colors mt-6"
              onClick={handlePayNow}
              disabled={loading}
            >
              {loading ? "Processing..." : "Pay with GCash"}
            </button>
          </div>
        );

      case 'PAYPAL':
        return (
          <div className="fixed bottom-4 right-[400px] bg-white rounded-xl shadow-lg w-80 max-w-md p-6">
            <div className="flex justify-between items-center mb-4 border-b border-gray-300 pb-2">
              <span className="text-lg font-bold">PayPal Payment</span>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <p className="text-sm font-semibold text-gray-800 mb-2">
              Total: P {parseFloat(paymentItem.amount.replace('$', '')).toFixed(2)}
            </p>
            <p className="text-sm text-gray-600 mb-4">
              You will be redirected to PayPal to complete your payment.
            </p>
            <button
              className="w-full py-3 bg-[#FF9800] text-white rounded-xl font-semibold hover:bg-[#FF9B45] transition-colors mt-6"
              onClick={handlePayNow}
              disabled={loading}
            >
              {loading ? "Processing..." : "Continue to PayPal"}
            </button>
          </div>
        );

      case 'BANK_TRANSFER':
        return (
          <div className="fixed bottom-4 right-[400px] bg-white rounded-xl shadow-lg w-80 max-w-md p-6">
            <div className="flex justify-between items-center mb-4 border-b border-gray-300 pb-2">
              <span className="text-lg font-bold">Bank Transfer Details</span>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <p className="text-sm font-semibold text-gray-800 mb-2">
              Total: P {parseFloat(paymentItem.amount.replace('$', '')).toFixed(2)}
            </p>
            <div className="bg-gray-100 p-4 rounded-lg">
              <p className="text-sm font-bold text-gray-800">Bank Name:</p>
              <p className="text-sm text-gray-600 mb-2">Your Bank Name</p>
              <p className="text-sm font-bold text-gray-800">Account Name:</p>
              <p className="text-sm text-gray-600 mb-2">Your Company Name</p>
              <p className="text-sm font-bold text-gray-800">Account Number:</p>
              <p className="text-sm text-gray-600">123-456-7890</p>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Please transfer the exact amount and send a screenshot of the transaction to our support team for confirmation.
            </p>
            <button
              className="w-full py-3 bg-[#FF9800] text-white rounded-xl font-semibold hover:bg-[#FF9B45] transition-colors mt-6"
              onClick={handlePayNow}
              disabled={loading}
            >
              {loading ? "Processing..." : "I have Paid"}
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      {renderPaymentDetails()}

      {/* ✅ Toast error bottom-right */}
      {errorMessage && (
        <div className="fixed bottom-5 right-5 w-44 text-center bg-red-500 text-white px-4 py-3 rounded-lg shadow-lg text-sm font-bold animate-slide-right z-[9999]">
          {errorMessage}
        </div>
      )}

      {/* Inline CSS for animation */}
      <style>
        {`
          @keyframes slide-right {
            from {
              opacity: 0;
              transform: translateX(100%);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }
          .animate-slide-right {
            animation: slide-right 0.3s ease-out;
          }
        `}
      </style>
    </div>
  );

};

export default Payment;
