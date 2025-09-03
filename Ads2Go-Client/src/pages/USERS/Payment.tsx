import React, { useState, useEffect } from 'react';
import { CreditCard, User, Calendar, Lock } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom'; 
import { useMutation, gql } from '@apollo/client';

interface PaymentItem {
  id: string;
  productName: string;
  imageUrl: string;
  plan: string;
  amount: string;
  status: string;
  userName: string;
  companyName: string;
  bankNumber: string;
  adType?: string;
  address?: string;
  durationDays: number;
  paymentType?: string;
  adFormat: string;
  adLengthSeconds: number;
  totalPrice: string;
  receiptId?: string;
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

// Media display component for payment preview (following ManageAds.tsx pattern)
const PaymentMediaPreview: React.FC<{ mediaFile: string; adFormat: string; productName: string }> = ({ 
  mediaFile, 
  adFormat, 
  productName 
}) => {
  const [mediaError, setMediaError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const handleError = () => {
    setMediaError(true);
    setIsLoading(false);
  };

  const handleLoad = () => {
    setIsLoading(false);
  };

  if (mediaError || !mediaFile) {
    return (
      <div className="w-20 h-20 bg-gray-200 rounded-lg flex items-center justify-center">
        <span className="text-xs text-gray-500 text-center">No Media</span>
      </div>
    );
  }

  if (adFormat === 'VIDEO') {
    return (
      <div className="w-20 h-20 rounded-lg overflow-hidden bg-black flex items-center justify-center relative">
        {isLoading && (
          <div className="absolute inset-0 bg-gray-200 animate-pulse rounded-lg flex items-center justify-center">
            <span className="text-xs text-gray-500">Loading...</span>
          </div>
        )}
        <video
          controls
          className="max-w-full max-h-full object-cover"
          onError={(e) => {
            handleError();
            // Additional error handling like in ManageAds
            const errorDiv = document.createElement('div');
            errorDiv.className = 'w-full h-full flex items-center justify-center text-gray-500 text-xs';
            errorDiv.innerHTML = 'Video not available';
            e.currentTarget.style.display = 'none';
            e.currentTarget.parentNode?.appendChild(errorDiv);
          }}
          onLoadedData={handleLoad}
          onLoadStart={() => setIsLoading(false)}
        >
          <source src={mediaFile} />
          Your browser does not support the video tag.
        </video>
      </div>
    );
  }

  // For IMAGE format (following ManageAds.tsx pattern)
  return (
    <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center relative">
      {isLoading && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse rounded-lg flex items-center justify-center">
          <span className="text-xs text-gray-500">Loading...</span>
        </div>
      )}
      <img
        src={mediaFile}
        alt={`${productName} preview`}
        className="max-w-full max-h-full object-cover"
        onError={(e) => {
          handleError();
          // Fallback image like in ManageAds
          e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIG5vdCBhdmFpbGFibGU8L3RleHQ+PC9zdmc+';
        }}
        onLoad={handleLoad}
      />
    </div>
  );
};

const Payment: React.FC = () => {
  const [paymentType, setPaymentType] = useState<string>('');
  const [cardDetails, setCardDetails] = useState({
    number: '',
    holder: '',
    expiry: '',
    cvv: '',
    type: '',
  });

  const [personalInfo, setPersonalInfo] = useState({
    address: 'P.o.Box 1223',
    city: 'Arusha',
    state: 'Arusha, Tanzania',
    postalCode: '9090',
  });

  const location = useLocation();
  const navigate = useNavigate();
  const [createPayment] = useMutation(CREATE_PAYMENT);

  // Get payment item and return path from navigation state
  const paymentItem = location.state?.paymentItem as PaymentItem;
  const returnTo = location.state?.returnTo || '/advertisements';

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>, key: string) => {
    setPersonalInfo({ ...personalInfo, [key]: e.target.value });
  };

  const detectCardType = (number: string) => {
    const cleaned = number.replace(/\D/g, '');
    if (/^4[0-9]{12}(?:[0-9]{3})?$/.test(cleaned)) return 'Visa';
    if (/^5[1-5][0-9]{14}$/.test(cleaned)) return 'Mastercard';
    return 'Unknown';
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const number = e.target.value;
    const type = detectCardType(number);
    setCardDetails({ ...cardDetails, number, type });
  };

  const mapPaymentType = (type: string): string => {
    switch (type) {
      case 'card':
        return 'CREDIT_CARD';
      case 'gcash':
        return 'GCASH';
      case 'paypal':
        return 'PAYPAL';
      case 'gpay':
      case 'maya':
      case 'cash':
        return 'BANK_TRANSFER';
      default:
        return 'CREDIT_CARD';
    }
  };

  const handleContinue = async () => {
    if (!paymentType) {
      alert("Please select a payment method.");
      return;
    }

    // If this is a payment for a specific item from PaymentHistory
    if (paymentItem) {
      const input = {
        adsId: paymentItem.id,
        paymentType: mapPaymentType(paymentType),
        receiptId: `REC-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`, 
        paymentDate: new Date().toISOString(),
      };

      try {
        const { data: mutationData } = await createPayment({ variables: { input } });

        if (mutationData?.createPayment?.success) {
          alert(`Payment for ${paymentItem.productName} is now PAID!`);
          // Navigate back to the return path (usually PaymentHistory)
          navigate(returnTo);
        } else {
          alert(mutationData?.createPayment?.message || "Payment failed");
        }
      } catch (e: any) {
        console.error('Payment error:', e);
        alert(e.message || "Failed to create payment.");
      }
    } else {
      // This is a regular payment flow (not from PaymentHistory)
      alert("Payment processing for regular flow - implement as needed");
      navigate(returnTo);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-2 pt-20 pl-36 rounded-lg">
      <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">Payment Information</h1>

      {/* Display Payment Item Details if coming from PaymentHistory */}
      {paymentItem && (
        <div className="mb-6 p-4 bg-blue-50 border-l-4 border-blue-400 text-blue-800 rounded-lg">
          <div className="flex items-center space-x-4 mb-4">
            <PaymentMediaPreview 
              mediaFile={paymentItem.imageUrl} 
              adFormat={paymentItem.adFormat} 
              productName={paymentItem.productName}
            />
            <div className="flex-grow">
              <h3 className="font-semibold text-lg text-blue-900">{paymentItem.productName}</h3>
              <div className="text-sm text-blue-700 mt-1 space-y-1">
                <p>Plan: {paymentItem.plan}</p>
                <p>Ad ID: {paymentItem.id}</p>
                <p>Format: {paymentItem.adFormat}</p>
                <p>Type: {paymentItem.adType}</p>
                {paymentItem.adLengthSeconds > 0 && (
                  <p>Duration: {paymentItem.adLengthSeconds}s</p>
                )}
              </div>
            </div>
          </div>
          <div className="border-t border-blue-300 pt-3">
            <p className="text-xl font-bold text-blue-900">
              Amount Due: P {parseFloat(paymentItem.amount.replace(',', '')).toFixed(2)}
            </p>
          </div>
        </div>
      )}

      {/* Personal Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {['address', 'city', 'state', 'postalCode'].map((field) => (
          <div key={field}>
            <label className="text-sm font-medium text-gray-800 mb-1 block capitalize">{field.replace(/([A-Z])/g, ' $1')}</label>
            <input
              type="text"
              value={personalInfo[field as keyof typeof personalInfo]}
              onChange={(e) => handleInput(e, field)}
              className="w-full border border-[#3674B5] rounded-lg px-3 py-2"
            />
          </div>
        ))}
      </div>

      {/* Payment Methods */}
      <div className="mb-6">
        <h2 className="font-semibold text-gray-700 mb-3">Select Payment Method</h2>
        <div className="flex flex-wrap gap-4">
          {["card", "gcash", "paypal", "gpay", "maya", "cash"].map((method) => (
            <button
              key={method}
              onClick={() => setPaymentType(method)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition 
                ${paymentType === method ? 'bg-[#3674B5] text-white border-[#3674B5]' : 'bg-white border-[#3674B5] hover:bg-[#3674B5] hover:text-white'}`}
            >
              <img src={`/icons/${method}.png`} alt={method} className="h-6 w-6" />
              <span className="capitalize">{method}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Conditional Payment Fields */}
      <div className="mb-8">
        {paymentType === "card" && (
          <>
            <h2 className="font-semibold text-gray-700 mb-3">Card Information</h2>
            <div className="space-y-4">
              <div className="relative">
                <User className="absolute left-3 top-3 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Cardholder Name"
                  className="pl-10 w-full border border-[#3674B5] rounded-lg px-3 py-2"
                  value={cardDetails.holder}
                  onChange={(e) => setCardDetails({ ...cardDetails, holder: e.target.value })}
                />
              </div>
              <div className="relative">
                <CreditCard className="absolute left-3 top-3 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Card Number"
                  className="pl-10 w-full border border-[#3674B5] rounded-lg px-3 py-2"
                  value={cardDetails.number}
                  onChange={handleCardNumberChange}
                />
              </div>
              {cardDetails.type && (
                <p className="text-sm text-gray-500 ml-1">Detected: {cardDetails.type}</p>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                  <Calendar className="absolute left-3 top-3 text-gray-400" size={18} />
                  <input
                    type="text"
                    placeholder="MM/YY"
                    className="pl-10 w-full border border-[#3674B5] rounded-lg px-3 py-2"
                    value={cardDetails.expiry}
                    onChange={(e) => setCardDetails({ ...cardDetails, expiry: e.target.value })}
                  />
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 text-gray-400" size={18} />
                  <input
                    type="text"
                    placeholder="CVC"
                    className="pl-10 w-full border border-[#3674B5] rounded-lg px-3 py-2"
                    value={cardDetails.cvv}
                    onChange={(e) => setCardDetails({ ...cardDetails, cvv: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </>
        )}

        {paymentType === 'gcash' && (
          <>
            <h2 className="font-semibold text-gray-700 mb-3">GCash Details</h2>
            <input type="text" placeholder="GCash Number" className="w-full border border-[#3674B5] px-3 py-2 mb-3 rounded-lg" />
            <input type="text" placeholder="Account Holder Name" className="w-full border border-[#3674B5] px-3 py-2 rounded-lg" />
          </>
        )}

        {paymentType === 'paypal' && (
          <>
            <h2 className="font-semibold text-gray-700 mb-3">PayPal Email</h2>
            <input type="email" placeholder="example@paypal.com" className="w-full border border-[#3674B5] px-3 py-2 rounded-lg" />
          </>
        )}

        {paymentType === 'gpay' && (
          <>
            <h2 className="font-semibold text-gray-700 mb-3">Google Pay</h2>
            <input type="email" placeholder="GPay Email or Phone" className="w-full border border-[#3674B5] px-3 py-2 rounded-lg" />
          </>
        )}

        {paymentType === 'maya' && (
          <>
            <h2 className="font-semibold text-gray-700 mb-3">Maya Details</h2>
            <input type="text" placeholder="Maya Account Number" className="w-full border border-[#3674B5] px-3 py-2 rounded-lg mb-3" />
            <input type="text" placeholder="Account Holder Name" className="w-full border border-[#3674B5] px-3 py-2 rounded-lg" />
          </>
        )}

        {paymentType === 'cash' && (
          <div className="bg-yellow-50 p-4 border-l-4 border-yellow-400 rounded-lg">
            <h2 className="font-semibold text-gray-700 mb-2">Pay at Office</h2>
            <p className="text-sm text-gray-600">
              Please visit our office at <strong>123 Main Street, Arusha</strong> between <strong>8:00 AM – 4:00 PM</strong>, Monday–Friday.
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <button 
          onClick={() => navigate(returnTo)}
          className="px-5 py-2 rounded-lg hover:bg-gray-100 border border-gray-300 text-gray-700"
        >
          Back
        </button>
        <button 
          onClick={handleContinue}
          className="px-6 py-2 rounded-lg bg-[#3674B5] hover:bg-[#578FCA] text-white font-semibold shadow hover:scale-105 transition-all duration-300"
        >
          {paymentItem ? 'Complete Payment' : 'Continue'}
        </button>
      </div>
    </div>
  );
};

export default Payment;
