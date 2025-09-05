import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from 'lucide-react';
import { useQuery, gql } from '@apollo/client';

type Status = "Paid" | "Pending" | "Failed";

interface PaymentItem {
  id: string;
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
  durationDays: number;
  paymentType?: string;
  adFormat: string;
  adLengthSeconds: number;
  totalPrice: string;
  receiptId?: string;
}

const GET_USER_ADS_WITH_PAYMENTS = gql`
  query GetUserAdsWithPayments {
    getUserAdsWithPayments {
      ad {
        id
        title
        mediaFile
        adType
        adFormat
        adLengthSeconds
        totalPrice
        durationDays
        planId {
          title
          durationDays
        }
      }
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

// Media display component to handle both images and videos (following ManageAds.tsx pattern)
const MediaDisplay: React.FC<{ mediaFile: string; adFormat: string; productName: string }> = ({ 
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

  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    handleError();
    // Additional error handling like in ManageAds
    const errorDiv = document.createElement('div');
    errorDiv.className = 'w-full h-full flex items-center justify-center text-gray-500 text-xs';
    errorDiv.innerHTML = 'Video not available';
    e.currentTarget.style.display = 'none';
    e.currentTarget.parentNode?.appendChild(errorDiv);
  };

  if (mediaError || !mediaFile) {
    return (
      <div className="w-24 h-24 bg-gray-200 rounded-lg flex items-center justify-center">
        <span className="text-xs text-gray-500 text-center">No Media</span>
      </div>
    );
  }

  if (adFormat === 'VIDEO') {
    return (
      <div className="w-24 h-24 rounded-lg overflow-hidden bg-black flex items-center justify-center relative">
        {isLoading && (
          <div className="absolute inset-0 bg-gray-200 animate-pulse rounded-lg flex items-center justify-center">
            <span className="text-xs text-gray-500">Loading...</span>
          </div>
        )}
        <video
          controls
          className="max-w-full max-h-full object-cover"
          onError={handleVideoError}
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
    <div className="w-24 h-24 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center relative">
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

const PaymentHistory: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<Status | "All Status">("All Status");
  const [planFilter, setPlanFilter] = useState("All Plans");
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 9;
  const navigate = useNavigate();

  const { loading, error, data, refetch } = useQuery(GET_USER_ADS_WITH_PAYMENTS, {
    fetchPolicy: 'cache-and-network', // Similar to ManageAds
    errorPolicy: 'all',
  });

  const [payments, setPayments] = useState<PaymentItem[]>([]);

  useEffect(() => {
    if (data) {
      console.log('Raw data from GET_USER_ADS_WITH_PAYMENTS:', data.getUserAdsWithPayments);
      const mappedPayments = data.getUserAdsWithPayments.map(({ ad, payment }: any) => {
        console.log('Ad:', ad.id, 'Payment:', payment);
        const durationDays = ad.durationDays || ad.planId?.durationDays || 0;
        let plan: string;
        switch (durationDays) {
          case 30:
            plan = "30 Days";
            break;
          case 60:
            plan = "60 Days";
            break;
          case 90:
            plan = "90 Days";
            break;
          case 120:
            plan = "120 Days";
            break;
          default:
            plan = `${durationDays} Days`;
        }
        const status = mapStatus(payment?.paymentStatus);
        const amount = `$${(payment?.amount || ad.totalPrice || 0).toFixed(2)}`;
        const totalPrice = `$${ad.totalPrice.toFixed(2)}`;

        return {
          id: ad.id,
          productName: ad.title,
          imageUrl: ad.mediaFile || "", // No fallback URL - let error handling manage it
          plan,
          amount,
          status,
          userName: "",
          companyName: "",
          bankNumber: "",
          adType: ad.adType,
          address: "",
          durationDays,
          paymentType: payment?.paymentType || "",
          adFormat: ad.adFormat || "IMAGE",
          adLengthSeconds: ad.adLengthSeconds || 0,
          totalPrice,
          receiptId: payment?.receiptId || "",
        };
      });
      setPayments(mappedPayments);
    }
  }, [data]);

  // Refresh data when component mounts or when coming back from payment page
  useEffect(() => {
    refetch();
  }, [refetch]);

  const mapStatus = (status?: string): Status => {
    if (!status) return "Pending";
    return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase() as Status;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 pl-64 pr-5 p-10">
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-lg text-gray-600">Loading payments...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 pl-64 pr-5 p-10">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <strong className="font-bold">Error loading payments: </strong>
          <span className="block sm:inline">{error.message}</span>
          <button
            onClick={() => refetch()}
            className="mt-2 bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const filteredPayments = payments.filter((item) => {
    const matchesSearchTerm = item.productName.toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
                             item.id.toString().includes(searchTerm.trim());
    const matchesStatus = statusFilter === "All Status" || item.status === statusFilter;
    const matchesPlan = planFilter === "All Plans" || item.plan === planFilter;

    return matchesSearchTerm && matchesStatus && matchesPlan;
  });

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentPayments = filteredPayments.slice(indexOfFirstItem, indexOfLastItem);
  console.log('Current Payments:', currentPayments);
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

  const handlePayBills = (item: PaymentItem) => {
    // Navigate to payment page with the payment item data
    navigate('/payment', { 
      state: { 
        paymentItem: item,
        returnTo: '/history' // So we know where to return after payment
      } 
    });
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
            <option>All Plans</option>
            <option>30 Days</option>
            <option>60 Days</option>
            <option>90 Days</option>
            <option>120 Days</option>
          </select>
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
            <svg className="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
        <div className="relative flex-grow">
          <input
            type="text"
            placeholder="Search Ads"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="text-xs text-black rounded-3xl pl-10 pr-4 py-3 w-full shadow-md border border-black focus:outline-none bg-gray-100"
          />
          <Search className="absolute left-3 top-3 text-gray-500" size={18} />
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
                <div className="flex-shrink-0">
                  <MediaDisplay 
                    mediaFile={item.imageUrl} 
                    adFormat={item.adFormat} 
                    productName={item.productName}
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
                  <p className="text-xs text-gray-500 mt-1">Format: {item.adFormat}</p>
                </div>
              </div>

              {/* Additional Details Section */}
              <div className="px-4 pb-4 text-sm text-gray-700 grid grid-cols-2 gap-y-2">
                <div className="flex justify-between items-center col-span-2">
                  <strong>Ads ID:</strong> <span>{item.id}</span>
                </div>
                <div className="flex justify-between items-center col-span-2">
                  <strong>Mode of Payment:</strong> <span>{item.paymentType || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center col-span-2">
                  <strong>Ad Type:</strong> <span>{item.adType || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center col-span-2">
                  <strong>adLengthSeconds:</strong> <span>{item.adLengthSeconds || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center col-span-2">
                  <strong>receiptId:</strong> <span>{item.receiptId || 'N/A'}</span>
                </div>
              </div>
              
              {/* Total and Amount Section (above buttons) */}
              <div className="border-t border-gray-200 p-4 flex justify-between items-center">
                <p className="text-base font-semibold text-gray-700">Total:</p>
                <p className="text-xl font-bold text-[#3674B5]">P {parseFloat(item.amount.replace('$', '')).toFixed(2)}</p>
              </div>

              {/* Action Buttons */}
              <div className="px-4 pb-4 flex justify-end space-x-3">
                <button
                  onClick={() => navigate(`/payment-details/${item.id}`)}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  See Details
                </button>
                {(item.status === "Pending" || item.status === "Failed") && (
                  <button
                    onClick={() => handlePayBills(item)}
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
            {searchTerm || statusFilter !== 'All Status' || planFilter !== 'All Plans' ? 
              'No payments match your search criteria' : 
              'No payments found'
            }
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
    </div>
  );
};

export default PaymentHistory;
