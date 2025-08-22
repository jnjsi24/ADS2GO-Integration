import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, CreditCard, User, Calendar, Lock } from 'lucide-react'; // Import all necessary icons

type Status = "Paid" | "Pending" | "Failed";

interface PaymentItem {
  id: number;
  productName: string;
  imageUrl: string;
  plan: string;
  amount: string;
  status: Status;
  userName: string;
  companyName: string;
  bankNumber: string;
  adType?: string;
  address?: string;
}

const mockPayments: PaymentItem[] = [
  // 2 Paid items
  {
    id: 1,
    productName: "Mahabang Name na Product",
    imageUrl: "https://via.placeholder.com/80",
    plan: "Monthly",
    amount: "$50.00",
    status: "Paid" as Status,
    userName: "John Doe",
    companyName: "Acme Inc.",
    bankNumber: "1234 5678 9012 3456",
    adType: "Video",
    address: "Quezon City",
  },
  {
    id: 2,
    productName: "Product Paid 2",
    imageUrl: "https://via.placeholder.com/80",
    plan: "Weekly",
    amount: "$60.00",
    status: "Paid" as Status,
    userName: "Jane Smith",
    companyName: "Beta LLC",
    bankNumber: "6543 2109 8765 4321",
    adType: "Image",
    address: "Manila",
  },
  // 2 Pending items
  {
    id: 3,
    productName: "Product Pending 1",
    imageUrl: "https://via.placeholder.com/80",
    plan: "Weekly",
    amount: "$100.00",
    status: "Pending" as Status,
    userName: "Alex Brown",
    companyName: "Gamma Corp.",
    bankNumber: "4321 8765 2109 6543",
    adType: "Video",
    address: "Quezon City",
  },
  {
    id: 4,
    productName: "Product Pending 2",
    imageUrl: "https://via.placeholder.com/80",
    plan: "Monthly",
    amount: "$115.00",
    status: "Pending" as Status,
    userName: "Sarah Davis",
    companyName: "Delta Ltd.",
    bankNumber: "9876 5432 1098 7654",
    adType: "Image",
    address: "Cebu",
  },
  // 3 Failed items
  {
    id: 5,
    productName: "Product Failed 1",
    imageUrl: "https://via.placeholder.com/80",
    plan: "Monthly",
    amount: "$80.00",
    status: "Failed" as Status,
    userName: "Michael Lee",
    companyName: "Echo Inc.",
    bankNumber: "5678 1234 9012 3456",
    adType: "Video",
    address: "Davao",
  },
  {
    id: 6,
    productName: "Product Failed 2",
    imageUrl: "https://via.placeholder.com/80",
    plan: "Monthly",
    amount: "$92.00",
    status: "Failed" as Status,
    userName: "Emily Wilson",
    companyName: "Foxtrot LLC",
    bankNumber: "3456 7890 1234 5678",
    adType: "Image",
    address: "Makati",
  },
  {
    id: 7,
    productName: "Product Failed 3",
    imageUrl: "https://via.placeholder.com/80",
    plan: "Weekly",
    amount: "$104.00",
    status: "Failed" as Status,
    userName: "David Taylor",
    companyName: "Golf Corp.",
    bankNumber: "2109 6543 8765 4321",
    adType: "Video",
    address: "Baguio",
  },
];

const PaymentHistory: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<Status | "All Status">("All Status");
  const [planFilter, setPlanFilter] = useState("All Plans");
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 9;
  const navigate = useNavigate();

  // State for controlling the payment popup and selected item
  const [showPaymentPopup, setShowPaymentPopup] = useState(false);
  const [selectedPaymentItem, setSelectedPaymentItem] = useState<PaymentItem | null>(null);

  // States and handlers moved from Payment.tsx
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
    setCardDetails((prev) => ({
      ...prev,
      number,
      type: detectCardType(number),
    }));
  };

  const handleProceed = () => {
    // Implement your payment processing logic here
    console.log("Processing payment for:", selectedPaymentItem);
    console.log("Payment Type:", paymentType);
    console.log("Card Details:", cardDetails);
    console.log("Personal Info:", personalInfo);
    // After successful payment (mock for now), close the popup
    alert(`Payment for ${selectedPaymentItem?.productName || 'item'} processed!`);
    setShowPaymentPopup(false); // Close the popup
  };
  // End of states and handlers moved from Payment.tsx

  const filteredPayments = mockPayments.filter((item) => {
    const matchesSearchTerm = item.productName.toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
                              item.id.toString().includes(searchTerm.trim());
    const matchesStatus = statusFilter === "All Status" || item.status === statusFilter;
    const matchesPlan = planFilter === "All Plans" || item.plan === planFilter;

    return matchesSearchTerm && matchesStatus && matchesPlan;
  });

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentPayments = filteredPayments.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredPayments.length / itemsPerPage);
  const startItem = indexOfFirstItem + 1;
  const endItem = Math.min(indexOfLastItem, filteredPayments.length);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const getStatusStyle = (status: Status) => {
    switch (status) {
      case "Paid":
        return "bg-green-200 text-green-800";
      case "Pending":
        return "bg-yellow-200 text-yellow-800";
      case "Failed":
        return "bg-red-200 text-red-800";
      default:
        return "";
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 pl-64 pr-5">
      <div className="bg-gray-100 p-6 flex justify-between items-center">
        <h1 className="text-4xl mt-8 font-semibold">Payment</h1>
      </div>
      {/* Filters */}
      <div className="p-6 flex space-x-4">
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as Status | "All Status")}
            className="text-xs text-black rounded-3xl pl-5 pr-10 py-3 shadow-md border border-black focus:outline-none appearance-none bg-gray-100"
          >
            <option value="All Status">All Status</option>
            <option value="Paid">Paid</option>
            <option value="Pending">Pending</option>
            <option value="Failed">Failed</option>
          </select>
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
            <svg className="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
        
        <div className="relative">
          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
            className="text-xs text-black rounded-3xl pl-5 pr-10 py-3 shadow-md border border-black focus:outline-none appearance-none bg-gray-100"
          >
            <option value="All Plans">All Plans</option>
            <option value="Monthly">Monthly</option>
            <option value="Weekly">Weekly</option>
          </select>
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
            <svg className="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
        <div className="relative w-96">
          <input
            type="text"
            placeholder="Search Ads"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="text-xs text-black rounded-xl pl-10 py-3 w-full shadow-md border border-black focus:outline-none appearance-none bg-white"
          />
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        </div>
      </div>

      {/* Payment Cards */}
      <div className="bg-gray-100 p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {currentPayments.length > 0 ? (
          currentPayments.map((item) => (
            <div
              key={item.id}
              className={`rounded-xl shadow-md bg-white overflow-hidden border border-gray-200`}
            >
              {/* Main Product Info Section */}
              <div className="p-4 flex items-center space-x-4">
                <div className="w-24 h-24 flex-shrink-0 flex items-center justify-center p-1 border border-gray-200 rounded-lg">
                  <img
                    src={item.imageUrl}
                    alt={`${item.productName} image`}
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
                <div className="flex-grow">
                  {/* Status aligned on the right of the product name/title */}
                  <div className="flex justify-between items-start">
                    <h3 className="text-lg font-semibold text-black">{item.productName}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs flex items-center gap-1 ${getStatusStyle(item.status)}`}>
                      <span>{item.status}</span>
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{item.plan} Plan</p>
                </div>
              </div>

              {/* Additional Details Section */}
              <div className="px-4 pb-4 text-sm text-gray-700 grid grid-cols-2 gap-y-2">
                <div className="flex justify-between items-center col-span-2">
                  <strong>Payment ID:</strong> <span>{item.id}</span>
                </div>
                <div className="flex justify-between items-center col-span-2">
                  <strong>Mode of Payment:</strong> <span>Gcash</span>
                </div>
                <div className="flex justify-between items-center col-span-2">
                  <strong>Company Name:</strong> <span>{item.companyName}</span>
                </div>
                <div className="flex justify-between items-center col-span-2">
                  <strong>User Name:</strong> <span>{item.userName}</span>
                </div>
                <div className="flex justify-between items-center col-span-2">
                  <strong>Bank Number:</strong> <span>{item.bankNumber}</span>
                </div>
                <div className="flex justify-between items-center col-span-2">
                  <strong>Ad Type:</strong> <span>{item.adType || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center col-span-2">
                  <strong>Address:</strong> <span>{item.address || 'N/A'}</span>
                </div>
              </div>
              
              {/* Total and Amount Section (above buttons) */}
              <div className="border-t border-gray-200 p-4 flex justify-between items-center">
                <p className="text-base font-semibold text-gray-700">Total:</p>
                <p className="text-xl font-bold text-[#3674B5]">P {parseFloat(item.amount.replace('$', '')).toFixed(0)}.000</p>
              </div>

              {/* Action Buttons */}
              <div className="px-4 pb-4 flex justify-end space-x-3">
                <button
                  onClick={() => navigate(`/ad-details/${item.id}`)}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  See Details
                </button>
                {(item.status === "Pending" || item.status === "Failed") && (
                  <button
                    onClick={() => {
                      setSelectedPaymentItem(item);
                      setPaymentType(''); // Reset payment type when opening new popup
                      setCardDetails({ number: '', holder: '', expiry: '', cvv: '', type: '' }); // Reset card details
                      setPersonalInfo({ address: 'P.o.Box 1223', city: 'Arusha', state: 'Arusha, Tanzania', postalCode: '9090' }); // Reset personal info
                      setShowPaymentPopup(true);
                    }}
                    className="px-4 py-2 text-sm bg-[#3674B5] text-white rounded-lg hover:bg-[#2a5b91] transition-colors"
                  >
                    Pay Bills
                  </button>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full text-center text-gray-500 py-8">
            No payments found for the selected filters.
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="p-4 rounded-lg mt-6 flex justify-between items-center">
        <span className="text-gray-500">
          Showing {startItem}-{endItem} of {filteredPayments.length}
        </span>
        <div className="flex space-x-2">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-2 py-1 border border-gray-300 rounded disabled:opacity-50"
          >
            «
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              onClick={() => handlePageChange(page)}
              className={`px-2 py-1 border border-gray-300 rounded ${
                currentPage === page ? 'bg-[#3674B5] text-white' : ''
              }`}
            >
              {page}
            </button>
          ))}
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="px-2 py-1 border border-gray-300 rounded disabled:opacity-50"
          >
            »
          </button>
        </div>
      </div>

      {/* Payment Popup (Content from Payment.tsx) */}
      {showPaymentPopup && (
        <div className="fixed inset-0 z-50 flex justify-end pr-2">
          {/* Overlay */}
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity duration-300"
            onClick={() => setShowPaymentPopup(false)} // Close on overlay click
          ></div>
          {/* Pop-up container */}
          <div className="relative w-1/3 max-w-xl h-[730px] pb-6 rounded-3xl bg-gray-100 mt-2 shadow-lg transform transition-transform duration-300 ease-in-out animate-slideIn">
            {/* Payment Content (formerly from Payment.tsx) */}
            <div className="p-6 h-full overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Complete Payment</h2>
              </div>

              {/* Display Payment Item Details at the top */}
              {selectedPaymentItem && (
                <div className="mb-6 p-4 bg-blue-50 border-l-4 border-blue-400 text-blue-800 rounded-lg">
                  <h3 className="font-semibold text-lg">Payment for: {selectedPaymentItem.productName}</h3>
                  <p className="text-sm">Plan: {selectedPaymentItem.plan}</p>
                  <p className="text-xl font-bold mt-2">Amount Due: P {parseFloat(selectedPaymentItem.amount.replace('$', '')).toFixed(0)}.000</p>
                </div>
              )}

              {/* Personal Details (adjusted for direct use) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                {['address', 'city', 'state', 'postalCode'].map((field) => (
                  <div key={field}>
                    <label className="text-sm font-medium text-gray-800 mb-1 block capitalize">{field.replace(/([A-Z])/g, ' $1')}</label>
                    <input
                      type="text"
                      value={personalInfo[field as keyof typeof personalInfo]}
                      onChange={(e) => handleInput(e, field)}
                      className="w-full bg-gray-200 border border-gray-300 rounded-lg p-2 focus outline-none"
                    />
                  </div>
                ))}
              </div>

              {/* Payment Type Selection */}
              <div className="mb-6">
                <h2 className="font-semibold text-gray-700 mb-3">Select Payment Method</h2>
                <div className="flex flex-wrap gap-4">
                  {/* Note: Ensure these icon paths or actual icons are available if using image-based buttons */}
                  {["card", "gcash", "paypal", "gpay", "maya", "cash"].map((method) => (
                    <button
                      key={method}
                      onClick={() => setPaymentType(method)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition
                        ${paymentType === method ? 'bg-[#1b5087] text-white border-[#3674B5] ' : 'bg-gray-200 border-black hover:bg-[#0E2A47] hover:text-white '}`}
                    >
                      <span className="capitalize">{method}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Conditional Payment Fields */}
              <div className="mb-8">
                {paymentType === 'card' && (
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

              {/* Action Buttons for the popup */}
              <div className="flex justify-between pt-4">
                <button 
                  onClick={() => setShowPaymentPopup(false)} // Close the popup
                  className="px-5 py-2 rounded-lg hover:bg-gray-200 border border-gray-300 text-gray-700"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleProceed}
                  className="px-6 py-2 rounded-lg bg-[#3674B5] hover:bg-[#0E2A47] text-white font-semibold hover:scale-105 transition-all duration-300"
                >
                  Proceed
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tailwind CSS Animation */}
      <style>
        {`
          @keyframes slideIn {
            from {
              transform: translateX(100%);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }
          .animate-slideIn {
            animation: slideIn 0.3s ease-out;
          }
        `}
      </style>
    </div>
  );
};

export default PaymentHistory;