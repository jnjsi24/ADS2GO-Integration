import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, ChevronDown, Clock, Calendar, MonitorSmartphone } from "lucide-react";
import { useQuery, gql } from "@apollo/client";
import { useUserAuth } from '../../contexts/UserAuthContext';
import Payment from "./Payment";
import { motion, AnimatePresence } from 'framer-motion';

// Align Status type with backend PaymentStatus enum
type Status = "PAID" | "PENDING" | "FAILED";

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
        createdAt
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

const getInitials = (firstName?: string, lastName?: string) => {
  if (!firstName && !lastName) return "?";
  return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();
};

const statusFilterOptions = [
  { label: 'All Status', value: 'All Status' },
  { label: 'Paid', value: 'PAID' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Failed', value: 'FAILED' },
];

const PaymentHistory: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 9;
  const navigate = useNavigate();
  const { user } = useUserAuth();
  const [showPlanDropdown, setShowPlanDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [selectedPlanFilter, setSelectedPlanFilter] = useState('All Plans');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('All Status');
  const [selectedPayment, setSelectedPayment] = useState<PaymentItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPaymentType, setSelectedPaymentType] = useState("");

  const { loading, error, data, refetch } = useQuery(GET_USER_ADS_WITH_PAYMENTS, {
    fetchPolicy: "network-only",
  });

  const [payments, setPayments] = useState<PaymentItem[]>([]);

  useEffect(() => {
    if (data) {
      const mappedPayments = data.getUserAdsWithPayments.map(({ ad, payment }: any) => {
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
          imageUrl: ad.mediaFile || "https://via.placeholder.com/80",
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
          adFormat: ad.adFormat || "",
          adLengthSeconds: ad.adLengthSeconds || 0,
          totalPrice,
          receiptId: payment?.receiptId || "",
          adStatus: ad.status || "PENDING", // Include ad approval status
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
    const matchesSearchTerm =
      item.productName.toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
      item.id.toString().includes(searchTerm.trim());
    const matchesPlan = selectedPlanFilter === 'All Plans' || item.plan === selectedPlanFilter;
    const matchesStatus = selectedStatusFilter === 'All Status' || item.status === selectedStatusFilter;

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
      className="absolute inset-0 bg-cover bg-center bg-fixed blur-sm brightness-90"
      style={{
        backgroundImage: "url('/image/bg2.jpg')",
      }}
    ></div>

    {/* Overlay */}
    <div className="absolute inset-0 bg-white/40 backdrop-blur-xl"></div>

    {/* ======= DESKTOP VIEW ======= */}
    <div className="hidden lg:block relative z-10 min-h-screen bg-transparent lg:pl-72 px-4 sm:px-5 lg:pr-5 py-6 lg:pt-10 lg:p-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4 pt-12 lg:pt-0">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Payment History</h1>

        {/* Search + Filters */}
        <div className="flex flex-col items-start lg:items-end gap-3 w-full lg:w-auto">
          <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
            <input
              type="text"
              className="text-xs text-black rounded-md pl-5 py-3 w-full sm:w-80 shadow-md focus:outline-none bg-white/70"
              placeholder="Search Advertisements"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {/* Filter for Status */}
            <div className="relative w-full sm:w-32">
              <button
                onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                className="flex items-center justify-between w-full text-xs text-black rounded-md pl-6 pr-4 py-3 shadow-md focus:outline-none bg-white/70 gap-2"
              >
                {statusFilterOptions.find(opt => opt.value === selectedStatusFilter)?.label || 'All Status'}
                <ChevronDown
                  size={16}
                  className={`transform transition-transform duration-200 ${showStatusDropdown ? 'rotate-180' : 'rotate-0'}`}
                />
              </button>
              <AnimatePresence>
                {showStatusDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="absolute z-10 top-full mt-2 w-full rounded-md shadow-lg bg-white overflow-hidden"
                  >
                    {statusFilterOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => handleStatusFilterChange(option.value)}
                        className="block w-full text-left px-4 py-2 text-xs ml-2 text-gray-700 hover:bg-gray-100 transition-colors duration-150"
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
      </div>

      {/* Payment Cards */}
      <div className="pt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
        {currentPayments.length > 0 ? (
          currentPayments.map((item) => (
            <div
              key={item.id}
              className="shadow-md bg-white/50 overflow-hidden relative flex flex-col cursor-pointer w-full transition-transform duration-300 hover:scale-[1.02]"
              onClick={() => setSelectedPayment(item)}
            >
              <div className="flex items-start">
                {/* Media Section */}
                <div className="w-1/4 relative h-44 flex-shrink-0">
                  {item.imageUrl ? (
                    item.adFormat?.toLowerCase() === "video" ? (
                      <video
                        src={item.imageUrl}
                        className="w-full h-full object-cover"
                        autoPlay
                        loop
                        muted
                        controls
                        onError={(e) => console.error("Video load error:", e)}
                      />
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
                  <div className="absolute -bottom-1 left-0 w-full bg-black/40 backdrop-blur-sm text-white text-center py-1 px-2">
                    <p className="text-sm font-semibold truncate">{item.productName}</p>
                  </div>
                </div>

                {/* Details */}
                <div className="w-3/4 pl-4 flex flex-col justify-between p-3">
                  <div>
                    <span
                      className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-medium ${getStatusStyle(item.status)}`}
                    >
                      {item.status}
                    </span>
                    <h3 className="text-2xl font-bold text-black/80 mt-2">
                      {item.amount}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {item.status === "PAID"
                        ? "Transaction completed successfully. Your advertisements are now available for viewing."
                        : "Awaiting payment confirmation. Your ad will be activated once the transaction is complete."}
                    </p>
                  </div>
                  <div className="flex justify-end mt-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPayment(item);
                        setSelectedPaymentType(item.paymentType || "");
                        setIsModalOpen(true);
                      }}
                      className="text-[#3674B5] hover:text-[#3674B5]/80 font-bold hover:underline text-xs px-4 py-2 transition-all duration-300 hover:underline-offset-4"
                    >
                      View Details
                    </button>
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
                currentPage === page ? "bg-[#3674B5] text-white" : ""
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

    {/* ======= MOBILE VIEW ======= */}
    <div className="block lg:hidden relative z-10 min-h-screen bg-transparent px-4 py-6">
      {/* You can freely adjust mobile layout here */}
      {/* For example, stack filters on top and make cards single-column */}

      {/* Search + Filter in one row */}
      <div className="block lg:hidden w-full space-y-4">
          {/* Row 1: Search and Status Filter */}
          <div className="flex gap-2 w-full">
            <input
              type="text"
              className="text-xs text-black rounded-md pl-4 py-3 flex-1 min-w-0 shadow-md focus:outline-none bg-white/70"
              placeholder="Search Payments"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <div className="relative min-w-[120px]">
              <button
                onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                className="flex items-center justify-between w-full text-xs text-black rounded-md pl-4 pr-3 py-3 shadow-md focus:outline-none bg-white/70 gap-2"
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
                    className="absolute z-10 top-full mt-2 w-full rounded-md shadow-lg bg-white overflow-hidden"
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

        {/* Title */}
        <h1 className="text-xl font-bold text-gray-800 mt-2">
          Payment History
        </h1>
      </div>

      {/* Payment Cards (1 per row) */}
      <div className="grid grid-cols-1 mt-4 gap-4">
        {currentPayments.map((item) => (
          <div
            key={item.id}
            className="bg-white/90 rounded-md shadow-md p-3 relative"
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
              <div className="w-28 h-28 rounded-md overflow-hidden bg-gray-200 flex-shrink-0">
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
                {/* Status badge */}
                <span
                  className={`inline-block text-[10px] px-2 py-1 rounded border ${
                    item.status === 'PAID'
                      ? 'border-green-500 text-green-700'
                      : item.status === 'FAILED'
                      ? 'border-red-500 text-red-700'
                      : 'border-yellow-400 text-yellow-700'
                  }`}
                >
                  {item.status === 'PENDING' ? 'Pending' : item.status === 'PAID' ? 'Paid' : 'Failed'}
                </span>
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
        ))}
      </div>

      {/* Pagination */}
      <div className="mt-6 flex justify-center items-center text-sm">
        <div className="flex space-x-1">
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
              className={`px-2 py-1 ${
                currentPage === page ? "text-black" : ""
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

    {/* Payment modal */}
    {isModalOpen && selectedPayment && (
      <Payment
        paymentItem={selectedPayment}
        paymentType={selectedPaymentType}
        onClose={closeModal}
        onSuccess={handlePaymentSuccess}
      />
    )}
  </div>
);

};

export default PaymentHistory;