import React, { useState } from 'react';
import { CreditCard, User, Calendar, Lock } from 'lucide-react';
import { Link } from 'react-router-dom'; 

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

  return (
    <div className="max-w-3xl mx-auto p-2 pt-20 pl-36 rounded-lg">
      <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">Payment Information</h1>

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
        <Link to="/advertisements">
        <button className="px-5 py-2 rounded-lg hover:bg-gray-100">Back</button>
        </Link>
        <button className="px-6 py-2 rounded-lg bg-[#3674B5] hover:bg-[#578FCA] text-white font-semibold shadow hover:scale-105 transition-all duration-300">
          Continue
        </button>
      </div>
    </div>
  );
};

export default Payment;
