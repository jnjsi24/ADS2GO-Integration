import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, ChevronDown, Clock, MonitorSmartphone, Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { useQuery, gql } from "@apollo/client";
import { useUserAuth } from '../../contexts/UserAuthContext';
import Payment from "./Payment";
import { motion, AnimatePresence } from 'framer-motion';

// Align Status type with backend PaymentStatus enum
type Status = "PAID" | "PENDING" | "FAILED" | null;

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
  adStatus?: string; // Ad approval status (PENDING, APPROVED, etc.)
  createdAt?: string; // Ad creation date
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
        status
        paymentStatus
        createdAt
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

const getInitials = (firstName?: string, lastName?: string) => {
  if (!firstName && !lastName) return "?";
  return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();
};

const statusFilterOptions = [
  { label: 'All Status', value: 'All Status' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Paid', value: 'PAID' },
];

const sortByOptions = ['Newest First', 'Oldest First', 'Amount (High to Low)', 'Amount (Low to High)', 'Alphabetical (A-Z)', 'Alphabetical (Z-A)'];

const PaymentHistory: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 9;
  const navigate = useNavigate();
  const { user } = useUserAuth();

  const [showPlanDropdown, setShowPlanDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [selectedPlanFilter, setSelectedPlanFilter] = useState('All Plans');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('All Status');
  const [selectedSortBy, setSelectedSortBy] = useState('Newest First');
  const [selectedPayment, setSelectedPayment] = useState<PaymentItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPaymentType, setSelectedPaymentType] = useState("");

  const { loading, error, data, refetch } = useQuery(GET_USER_ADS_WITH_PAYMENTS, {
    fetchPolicy: "network-only",
  });

  // Handle errors using useEffect (Apollo v3.14 recommended approach)
  useEffect(() => {
    if (error) {
      console.error('PaymentHistory - GraphQL Error:', error);
      console.error('PaymentHistory - Error details:', {
        message: error.message,
        graphQLErrors: error.graphQLErrors,
        networkError: error.networkError,
        extraInfo: error.extraInfo
      });
    }
  }, [error]);

  const [payments, setPayments] = useState<PaymentItem[]>([]);

  useEffect(() => {
    if (data) {
      
      const mappedPayments = data.getUserAdsWithPayments.map(({ ad, payment }: any) => {
        const durationDays = ad.durationDays || 0;
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
        // Determine the display status based on ad approval and payment status
        let displayStatus: Status;
        if (ad.status === 'RUNNING' && (payment?.paymentStatus === 'PAID' || ad.paymentStatus === 'PAID')) {
          displayStatus = 'PAID';
        } else if (ad.status === 'APPROVED' && (payment?.paymentStatus === 'PAID' || ad.paymentStatus === 'PAID')) {
          displayStatus = 'PAID';
        } else if (ad.status === 'APPROVED' && (payment?.paymentStatus === 'PENDING' || ad.paymentStatus === 'PENDING')) {
          displayStatus = 'PENDING'; // Ad approved, payment pending
        } else if (ad.status === 'PENDING') {
          displayStatus = null; // Ad not yet approved, no payment status
        } else if (payment?.paymentStatus === 'FAILED' || ad.paymentStatus === 'FAILED') {
          displayStatus = 'FAILED';
        } else {
          displayStatus = null; // Default fallback for unapproved ads
        }

        const amount = `$${(payment?.amount || ad.totalPrice || 0).toFixed(2)}`;
        const totalPrice = `$${ad.totalPrice.toFixed(2)}`;

        return {
          id: ad.id,
          productName: ad.title,
          imageUrl: ad.mediaFile || "https://via.placeholder.com/80",
          plan,
          amount,
          status: displayStatus,
          userName: "",
          companyName: "",
          bankNumber: "",
          adType: ad.adType,
          address: "",
          durationDays,
          paymentType: payment?.paymentType || "",
          adFormat: ad.adFormat || "",
          adLengthSeconds: ad.adLengthSeconds || 0,
          totalPrice,
          receiptId: payment?.receiptId || "",
          adStatus: ad.status || "PENDING", // Include ad approval status (this is the actual status from database)
          createdAt: ad.createdAt,
        };
      });
      setPayments(mappedPayments);
    }
  }, [data]);

  // Refresh data when component mounts or after payment
  useEffect(() => {
    refetch();
  }, [refetch]);

  const mapStatus = (status?: string): Status => {
    if (!status) return "PENDING";
    // Keep backend status as-is (PAID, PENDING, FAILED)
    return status as Status;
  };

  const filteredPayments = payments.filter((item) => {
    // First filter: Only show PENDING and PAID ads (exclude null and FAILED)
    if (item.status !== 'PENDING' && item.status !== 'PAID') {
      return false;
    }

    const matchesSearchTerm =
      item.productName.toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
      item.id.toString().includes(searchTerm.trim());
    const matchesPlan = selectedPlanFilter === 'All Plans' || item.plan === selectedPlanFilter;
    
    // Status filtering for PENDING and PAID only
    let matchesStatus = true;
    if (selectedStatusFilter !== 'All Status') {
      matchesStatus = item.status === selectedStatusFilter;
    }

    const matches = matchesSearchTerm && matchesStatus && matchesPlan;
    return matches;
  }).sort((a, b) => {
    switch (selectedSortBy) {
      case 'Newest First':
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      case 'Oldest First':
        return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      case 'Amount (High to Low)':
        const amountA = parseFloat(a.amount.replace('$', ''));
        const amountB = parseFloat(b.amount.replace('$', ''));
        return amountB - amountA;
      case 'Amount (Low to High)':
        const amountA2 = parseFloat(a.amount.replace('$', ''));
        const amountB2 = parseFloat(b.amount.replace('$', ''));
        return amountA2 - amountB2;
      case 'Alphabetical (A-Z)':
        return a.productName.toLowerCase().localeCompare(b.productName.toLowerCase());
      case 'Alphabetical (Z-A)':
        return b.productName.toLowerCase().localeCompare(a.productName.toLowerCase());
      default:
        return 0;
    }
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
      case "PAID":
        return "bg-green-200 text-green-700";
      case "PENDING":
        return "bg-yellow-200 text-yellow-700";
      default:
        return "bg-gray-200 text-gray-600";
    }
  };

  const handlePlanFilterChange = (plan: string) => {
    setSelectedPlanFilter(plan);
    setShowPlanDropdown(false);
  };

  const handleStatusFilterChange = (status: string) => {
    setSelectedStatusFilter(status);
    setShowStatusDropdown(false);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedPaymentType("");
    refetch();
  };

  const handlePaymentSuccess = () => {
    refetch(); // Refresh payments after successful payment
    setIsModalOpen(false); // Close modal
  };

  // Helper function to convert PaymentItem to Payment component format
  const convertToPaymentItem = (item: PaymentItem) => {
    return {
      ...item,
      status: item.status as "PAID" | "PENDING" | "FAILED" // Cast to exclude null
    };
  };

  // Calculate dynamic payment deadline (e.g., 7 days from ad creation)
  const getPaymentDeadline = (createdAt: string) => {
    const createdDate = new Date(createdAt);
    const deadline = new Date(createdDate);
    deadline.setDate(createdDate.getDate() + 7); // 7-day payment window
    return deadline.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background Image */}
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat blur-sm brightness-90"
        style={{ backgroundImage: "url('/image/bg2.jpg')" }}/>

      <div className="fixed inset-0 bg-white/40 backdrop-blur-xl" />

  {/* Main Content */}
  <div className="relative z-10 min-h-screen bg-transparent lg:pl-72 px-4 sm:px-5 lg:pr-5 py-6 lg:pt-10 lg:p-8">

    {/* ======= DESKTOP VIEW ======= */}
    <div className="hidden lg:block">
    {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4 pt-12 lg:pt-0">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Payment History</h1>

        {/* Search + Filters */}
        <div className="flex flex-col items-start lg:items-end gap-3 w-full lg:w-auto">
          <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
            <input
              type="text"
              className="text-xs text-black rounded-lg pl-5 py-3 w-full sm:w-80 shadow-md focus:outline-none bg-white/70"
              placeholder="Search Advertisements"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {/* Filter for Status */}
            <div className="relative w-full sm:w-36">
              <button
                onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                className="flex items-center justify-between w-full text-xs text-black rounded-lg pl-6 pr-4 py-3 shadow-md focus:outline-none bg-white/70 gap-2 hover:bg-white/80 transition-colors duration-200"
              >
                <span className="truncate">
                  {statusFilterOptions.find(opt => opt.value === selectedStatusFilter)?.label || 'All Status'}
                </span>
                <ChevronDown
                  size={16}
                  className={`transform transition-transform duration-200 flex-shrink-0 ${showStatusDropdown ? 'rotate-180' : 'rotate-0'}`}
                />
              </button>
              <AnimatePresence>
                {showStatusDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="absolute z-10 top-full mt-2 w-full rounded-lg shadow-lg bg-white overflow-hidden border border-gray-200"
                  >
                    {statusFilterOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => handleStatusFilterChange(option.value)}
                        className={`block w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-100 transition-colors duration-150 ${
                          selectedStatusFilter === option.value ? 'bg-blue-50 text-blue-700 font-medium' : ''
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            {/* Sort By Filter */}
            <div className="relative w-full sm:w-48">
              <button
                onClick={() => setShowSortDropdown(!showSortDropdown)}
                className="flex items-center justify-between w-full text-xs text-black rounded-lg pl-6 pr-4 py-3 shadow-md focus:outline-none bg-white/70 gap-2 hover:bg-white/80 transition-colors duration-200"
              >
                <span className="truncate">{selectedSortBy}</span>
                <ChevronDown
                  size={16}
                  className={`flex-shrink-0 transform transition-transform duration-200 ${showSortDropdown ? 'rotate-180' : 'rotate-0'}`}
                />
              </button>
              <AnimatePresence>
                {showSortDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="absolute z-10 top-full mt-2 w-full rounded-lg shadow-lg bg-white overflow-hidden max-h-60 overflow-y-auto border border-gray-200"
                  >
                    {sortByOptions.map((sortOption) => (
                      <button
                        key={sortOption}
                        onClick={() => {
                          setSelectedSortBy(sortOption);
                          setShowSortDropdown(false);
                        }}
                        className={`block w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-100 transition-colors duration-150 ${
                          selectedSortBy === sortOption ? 'bg-blue-50 text-blue-700 font-medium' : ''
                        }`}
                      >
                        {sortOption}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="col-span-full text-center text-gray-500 py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#3674B5]"></div>
          <p className="mt-2">Loading payment history...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="col-span-full text-center text-red-500 py-8">
          <p>Error loading payment history: {error.message}</p>
          <button 
            onClick={() => refetch()}
            className="mt-2 px-4 py-2 bg-[#3674B5] text-white rounded hover:bg-[#3674B5]/80"
          >
            Retry
          </button>
        </div>
      )}

      {/* Payment Cards */}
      {!loading && !error && (
        <div className="pt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
          {currentPayments.length > 0 ? (
          currentPayments.map((item) => (
            <div
              key={item.id || `${item.productName}-${item.totalPrice}`}
              className="shadow-md bg-white/50 overflow-hidden relative flex flex-col cursor-pointer w-full transition-transform duration-300 hover:scale-[1.02]"
              onClick={() => setSelectedPayment(item)}
            >
              <div className="flex items-start">
                {/* Media Section (image/video) */}
                <div className="w-1/4 relative h-44 flex-shrink-0">
                  {item.imageUrl ? (
                    item.adFormat && item.adFormat.toLowerCase() === "video" ? (
                      <video
                        src={item.imageUrl}
                        className="w-full h-full object-cover"
                        autoPlay
                        loop
                        muted
                        controls
                        onError={(e) => console.error("Video load error:", e)}
                      >
                        <source src={item.imageUrl} type="video/mp4" />
                        <source src={item.imageUrl} type="video/webm" />
                        <source src={item.imageUrl} type="video/ogg" />
                        Your browser does not support the video tag.
                      </video>
                    ) : (
                      <img
                        src={item.imageUrl}
                        alt={item.productName}
                        className="w-full h-full object-cover"
                        onError={(e) => console.error("Image load error:", e)}
                      />
                    )
                  ) : (
                    <div className="w-full h-full bg-gray-400 flex items-center justify-center text-black/70">
                      No Media
                    </div>
                  )}
                  {/* Overlay Title */}
                  <div className="absolute -bottom-1 left-0 w-full bg-black/40 backdrop-blur-sm text-white text-center py-1 px-2">
                    <p className="text-sm font-semibold truncate">{item.productName}</p>
                  </div>
                </div>

                {/* Details Section */}
                <div className="w-3/4 pl-4 flex flex-col justify-between p-3">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-medium ${getStatusStyle(
                          item.status
                        )}`}
                      >
                        {item.status}
                      </span>
                      <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPayment(item);
                        setSelectedPaymentType(item.paymentType || "");
                        setIsModalOpen(true);
                      }}
                      className="text-white px-3 py-2 bg-[#3674B5] rounded-full hover:bg-[#2a5a94] text-xs font-medium transition-all duration-300"
                      >
                      {item.status === 'PAID' ? 'View Details' : 'Make Payment'}
                    </button>
                    </div>
                    <h3 className="text-2xl font-bold text-black/80 mt-2">
                      {item.amount}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {item.status === "PAID"
                        ? "Transaction completed successfully. Your advertisements are now available for viewing."
                        : item.adStatus === "APPROVED"
                        ? "Ad approved! Awaiting payment confirmation. Your ad will be activated once the transaction is complete."
                        : item.adStatus === "PENDING"
                        ? "Ad pending approval. Payment will be available once your ad is approved by admin."
                        : "Awaiting payment confirmation. Your ad will be activated once the transaction is complete."}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full text-center text-gray-500 py-8">
            No payments found for the selected filters.
          </div>
        )}
      </div>
      )}

      {/* Pagination */}
      <div className="fixed bottom-0 left-0 right-0 pt-4 pb-2 z-50 lg:left-72">
        <div className="flex justify-center">
          <div className="flex items-center space-x-1">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="flex items-center px-2 py-1 text-sm rounded font-semibold hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              <span>Previous</span>
            </button>
            <div className="flex space-x-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => handlePageChange(page)}
                  className={`px-2 py-1 text-sm rounded ${
                    currentPage === page 
                      ? "text-black border border-black/40"
                      : "text-gray-700 hover:border border-gray-300"
                  }`}
                >
                  {page}
                </button>
              ))}
            </div>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="flex items-center px-2 py-1 text-sm rounded font-semibold hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4 ml-1" />
            </button>
          </div>
        </div>
      </div>
    </div>
    {/* End Desktop View */}

    {/* ======= MOBILE VIEW ======= */}
    <div className="block lg:hidden relative z-10 bg-transparent py-10">
    {/* ======= MOBILE VIEW ======= */}
    <div className="mb-16">
      <div className="block lg:hidden pb-4">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Payment History</h1>
        {/* Search and Filter Row */}
        <div className="flex gap-2 w-full mb-4">
          <input
            type="text"
            className="text-xs text-black rounded-md pl-5 py-3 flex-1 shadow-md focus:outline-none bg-white/70"
            placeholder="Search Payments"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <div className="relative w-32">
            <button
              onClick={() => setShowStatusDropdown(!showStatusDropdown)}
              className="flex items-center justify-between w-full text-xs text-black rounded-lg pl-4 pr-3 py-3 shadow-md focus:outline-none bg-white/70 gap-2"
            >
              {statusFilterOptions.find(opt => opt.value === selectedStatusFilter)?.label || 'All'}
              <ChevronDown
                size={16}
                className={`transform transition-transform duration-200 ${
                  showStatusDropdown ? 'rotate-180' : 'rotate-0'
                }`}
              />
            </button>
            <AnimatePresence>
              {showStatusDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="absolute z-10 top-full mt-2 w-full rounded-lg shadow-lg bg-white overflow-hidden border border-gray-200"
                >
                  {statusFilterOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleStatusFilterChange(option.value)}
                      className="block w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-100 transition-colors duration-150"
                    >
                      {option.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Payment Cards (1 per row) */}
      <div className="grid grid-cols-1 mt-4 gap-4">
        {currentPayments.length > 0 ? currentPayments.map((item) => (
          <div
            key={item.id || `${item.productName}-${item.totalPrice}`}
            className="bg-white/90 rounded-lg shadow-md p-3 relative"
            onClick={() => {
              setSelectedPayment(item);
              setSelectedPaymentType(item.paymentType || "");
              setIsModalOpen(true);
            }}
          >
            {item.status === 'PAID' && item.receiptId && (
              <div className="absolute top-2 right-2 px-2 py-1 text-[10px] text-black">
                {item.receiptId}
              </div>
            )}
            {/* Top row: thumbnail + details */}
            <div className="flex gap-3">
              <div className="w-28 h-28 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
                {item.imageUrl ? (
                  item.adFormat?.toLowerCase() === 'video' ? (
                    <video
                      src={item.imageUrl}
                      className="w-full h-full object-cover"
                      muted
                      playsInline
                      loop
                    />
                  ) : (
                    <img src={item.imageUrl} alt={item.productName} className="w-full h-full object-cover" />
                  )
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs">No Media</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                {/* Status and Pay Now button row */}
                <div className="flex justify-between items-start">
                  <span
                    className={`inline-block text-[10px] px-2 py-1 font-medium rounded ${
                      item.status === 'PAID'
                        ? 'bg-green-200 text-green-600'
                        : item.status === 'FAILED'
                        ? 'bg-red-200 text-red-600'
                        : 'bg-yellow-200 text-yellow-600'
                    }`}
                  >
                    {item.status === 'PENDING' ? 'Pending' : item.status === 'PAID' ? 'Paid' : 'Failed'}
                  </span>
                  {item.status === 'PENDING' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPayment(item);
                        setSelectedPaymentType(item.paymentType || "");
                        setIsModalOpen(true);
                      }}
                      className="bg-[#3674B5] text-white text-[10px] px-3 py-1 rounded-full hover:bg-[#2c5d94] transition-colors"
                    >
                      Pay Now
                    </button>
                  )}
                </div>
                <h3 className="text-lg font-semibold text-black mt-1 truncate">{item.productName}</h3>
                <p className="text-[15px] font-bold text-black mt-1">{item.amount}</p>
                <p className="text-xs text-black/70 mt-1 truncate">
                  {item.status === 'PAID'
                    ? 'Transaction completed successfully.'
                    : 'Awaiting payment confirmation. Your ad will be activated once the transaction is complete.'}
                </p>
              </div>
            </div>

            {/* Chips row */}
            <div className="grid grid-cols-3 gap-3 mt-4">
              <div className="flex items-center gap-2 text-[11px] text-black/80">
                <Clock size={14} className="text-black/80" />
                <span>{item.adLengthSeconds || 'N/A'} seconds</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-black/80">
                <MonitorSmartphone size={14} className="text-black/80" />
                <span>{item.adType || 'N/A'}</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-black/80">
                <Calendar size={14} className="text-black/80" />
                <span>{item.durationDays} days</span>
              </div>
            </div>
          </div>
        )) : (
          <div className="col-span-full text-center text-gray-500 py-8">
            No payments found for the selected filters.
          </div>
        )}
      </div>
      
      {/* Pagination */}
      <div className="fixed bottom-0 left-0 right-0 py-3 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center">
            <div className="flex space-x-1">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="flex items-center px-2 py-1 text-sm rounded font-semibold hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                <span>Previous</span>
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => handlePageChange(page)}
                  className={`px-2 py-1 text-sm rounded ${
                    currentPage === page ? "text-black border border-black/40"
                                  : "text-gray-700 hover:border border-gray-300"
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="flex items-center px-2 py-1 text-sm rounded font-semibold hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4 ml-1" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
    </div> 
    </div>
  </div>
  );
};

export default PaymentHistory;