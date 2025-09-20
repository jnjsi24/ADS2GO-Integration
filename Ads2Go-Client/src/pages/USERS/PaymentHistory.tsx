import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, ChevronDown } from "lucide-react";
import { useQuery, gql } from "@apollo/client";
import { useUserAuth } from '../../contexts/UserAuthContext';
import Payment from "./Payment";


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

const getInitials = (firstName?: string, lastName?: string) => {
  if (!firstName && !lastName) return "?";
  return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();
};

const PaymentHistory: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<Status | "All Status">(
    "All Status"
  );
  const [planFilter, setPlanFilter] = useState("All Plans");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 9;
  const navigate = useNavigate();
  const { user } = useUserAuth();
  const [selectedPayment, setSelectedPayment] = useState<PaymentItem | null>(
    null
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPaymentType, setSelectedPaymentType] = useState("");

  const { loading, error, data, refetch } = useQuery(
    GET_USER_ADS_WITH_PAYMENTS,
    {
      fetchPolicy: "network-only",
    }
  );

  const [payments, setPayments] = useState<PaymentItem[]>([]);

  useEffect(() => {
    if (data) {
      const mappedPayments = data.getUserAdsWithPayments.map(
        ({ ad, payment }: any) => {
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
          const amount = `$${(payment?.amount || ad.totalPrice || 0).toFixed(
            2
          )}`;
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
          };
        }
      );
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

  if (loading) return <p>Loading payments...</p>;
  if (error) return <p>Error loading payments: {error.message}</p>;

  const filteredPayments = payments.filter((item) => {
    const matchesSearchTerm =
      item.productName
        .toLowerCase()
        .includes(searchTerm.toLowerCase().trim()) ||
      item.id.toString().includes(searchTerm.trim());
    const matchesStatus =
      statusFilter === "All Status" || item.status === statusFilter;
    const matchesPlan = planFilter === "All Plans" || item.plan === planFilter;

    return matchesSearchTerm && matchesStatus && matchesPlan;
  });
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentPayments = filteredPayments.slice(
    indexOfFirstItem,
    indexOfLastItem
  );
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
        return "bg-green-300 text-green-800";
      case "Pending":
        return "bg-yellow-300 text-yellow-800";
      case "Failed":
        return "bg-red-300 text-red-800";
      default:
        return "";
    }
  };

  const getStatusColor = (status: Status) => {
    switch (status) {
      case "Paid":
        return "border-l-green-500";
      case "Pending":
        return "border-l-yellow-400";
      case "Failed":
        return "border-l-red-400";
      default:
        return "border-l-gray-400";
      }
    };

  const handlePaymentClick = (type: string) => {
    setSelectedPaymentType(type);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedPaymentType("");
    refetch(); // Refresh data after payment
  };

  const handlePaymentSuccess = () => {
    refetch(); // Refresh data on successful payment
  };

  return (
    <div className="min-h-screen bg-white pl-72 p-10">
      {/* Header with Search and Profile */}
      <div className="flex justify-between items-center mb-6 pt-10">
        <h1 className="text-3xl font-bold text-gray-800">Payment History</h1>
        <div className="flex flex-col items-end gap-3">
          <div className="flex gap-2">
            <input type="text" 
              className="text-xs text-black rounded-lg pl-5 py-3 w-80 shadow-md focus:outline-none bg-white" 
              placeholder="Search Advertisements" 
              value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} 
            />
            <div className="relative w-40">
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as Status | "All Status")
                }
                className="appearance-none w-full text-xs text-black rounded-lg pl-5 pr-10 py-3 shadow-md focus:outline-none bg-white"
              >
                <option value="All Status">All Status</option>
                <option value="Paid">Paid</option>
                <option value="Pending">Pending</option>
                <option value="Failed">Failed</option>
              </select>
              <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </div>
            </div>

            <div className="relative w-40">
              <select
                value={planFilter}
                onChange={(e) => setPlanFilter(e.target.value)}
                className="appearance-none w-full text-xs text-black rounded-lg pl-5 pr-10 py-3 shadow-md focus:outline-none bg-white"
              >
                <option>All Plans</option>
                <option>30 Days</option>
                <option>60 Days</option>
                <option>90 Days</option>
                <option>120 Days</option>
              </select>
              <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none">
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Cards */}
      <div className="bg-white pt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  {currentPayments.length > 0 ? (
    currentPayments.map((item) => (
      <div
        key={item.id}
         className="rounded-lg shadow-md bg-white overflow-hidden cursor-pointer relative"
        onClick={() => setSelectedPayment(item)}
      >
              {/* Main Product Info Section */}
        <div className="p-4 flex items-center space-x-4">
          <div className="flex-grow">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-black">{item.productName}</h3>
              </div>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              {item.paymentType || "NONE"}
            </p>
            {item.status === 'Pending' && (
              <p className="text-xs text-red-500 mt-5 font-semibold">
                No Payment has been made yet
              </p>
            )}
          </div>
        </div>
        <span
          className={`absolute top-2 right-2 inline-flex items-center justify-center px-2 py-1 rounded-full ${getStatusStyle(
            item.status
          )}`}
        >
           <span className="text-xs font-semibold text-white">
            {item.status}
          </span>
        </span>
        <button
        className="absolute bottom-2 right-2 border border-gray-200 rounded-lg p-2 text-xs text-gray-600 hover:bg-[#FF9800] hover:text-white font-medium"
        >
           View Details
        </button>
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

      {/* Overlay */}
      {selectedPayment && (
        <div className="fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-black opacity-20"
            onClick={() => setSelectedPayment(null)}
          ></div>
        </div>
      )}

      {/* Drawer */}
      <div
        className={`fixed top-2 right-2 h-[97%] bottom-1 w-full max-w-sm bg-white shadow-lg rounded-lg transform transition-transform duration-500 ease-in-out z-50 overflow-y-auto
          ${selectedPayment ? "translate-x-0" : "translate-x-full"}`}
      >
        {selectedPayment && (
          <div className="p-6">
            {/* Header */}
            <div className="flex justify-between items-center pb-4 mb-4 border-b border-gray-300">
              <span className="text-xs text-gray-600">Payment Details</span>
              <button
                onClick={() => setSelectedPayment(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Details */}
            <div className="mb-6">
              <div className="flex justify-between items-baseline mb-2">
                <span className="text-sm text-gray-600">Payment for</span>
                <span className="text-sm text-gray-600">Plan</span>
              </div>
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-[#1B5087]">
                  {selectedPayment.productName || "N/A"}
                </h3>
                <span className="font-semibold text-gray-900">
                  {selectedPayment.plan}
                </span>
              </div>
              {selectedPayment.status && (
                <div className="mt-2 text-right">
                  <span
                    className={`px-3 py-2 rounded-full text-xs font-semibold ${getStatusStyle(
                      selectedPayment.status
                    )}`}
                  >
                    {selectedPayment.status}
                  </span>
                </div>
              )}
            </div>

            {/* Info Table */}
            <div className="rounded-lg overflow-hidden border border-gray-200 mb-6">
              <table className="table-auto w-full border-collapse">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-2 text-left text-sm text-gray-800">
                      Name
                    </th>
                    <th className="px-4 py-2 text-right text-sm text-gray-800">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  <tr className="border-b">
                    <td className="px-4 py-2 text-gray-700">Mode of payment</td>
                    <td className="px-4 py-2 text-right text-gray-900">
                      {selectedPayment.paymentType || "N/A"}
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="px-4 py-2 text-gray-700">Ad Type</td>
                    <td className="px-4 py-2 text-right text-gray-900">
                      {selectedPayment.adType || "N/A"}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 text-gray-700">Ad Length</td>
                    <td className="px-4 py-2 text-right text-gray-900">
                      {selectedPayment.adLengthSeconds || "N/A"} seconds
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Receipt + Total */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <strong className="text-gray-700">Receipt ID</strong>
                <span className="text-gray-900">
                  {selectedPayment.receiptId || "N/A"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <strong className="text-gray-700">Total</strong>
                <span className="text-lg font-bold text-[#FF9800]">
                  P{" "}
                  {parseFloat(
                    selectedPayment.amount.replace("$", "")
                  ).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Payment methods - Only show if status is not "Paid" */}
            {selectedPayment.status !== "Paid" && (
              <div className="mt-6 border-t pt-4">
                <div className="flex items-center mb-4 text-sm text-[#8ABB6C]">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 mr-1"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>All your transactions are secure and fast.</span>
                </div>
                <p className="text-sm font-semibold text-gray-800 mb-2">
                  SELECT A PAYMENT METHOD
                </p>

                {[
                  { type: "CASH", label: "Cash" },
                  { type: "CREDIT_CARD", label: "Credit Card" },
                  { type: "DEBIT_CARD", label: "Debit Card" },
                  { type: "GCASH", label: "GCash" },
                  { type: "PAYPAL", label: "PayPal" },
                  { type: "BANK_TRANSFER", label: "Bank Transfer" },
                ].map((method) => (
                  <div
                    key={method.type}
                    className="bg-gray-100 rounded-lg p-3 mb-2 flex justify-between items-center cursor-pointer hover:bg-gray-200 transition-colors"
                    onClick={() => handlePaymentClick(method.type)}
                  >
                    <span>{method.label}</span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4 text-gray-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                ))}
              </div>
            )}

            {/* Show message for paid ads */}
            {selectedPayment.status === "Paid" && (
              <div className="mt-6 border-t pt-4">
                <div className="flex items-center justify-center p-4 bg-green-50 rounded-lg">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 mr-2 text-green-600"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-sm font-semibold text-green-800">
                    This advertisement has been paid successfully!
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
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