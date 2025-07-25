import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, CircleUser } from 'lucide-react';

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

const History: React.FC = () => {
  const [filter, setFilter] = useState<Status | "All">("All");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [planFilter, setPlanFilter] = useState("All Plans");
  const [selectedItem, setSelectedItem] = useState<PaymentItem | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedCardId, setExpandedCardId] = useState<number | null>(null);
  const itemsPerPage = 9;
  const navigate = useNavigate();

  const filteredPayments = filter === "All"
    ? mockPayments.filter((item) =>
        (item.productName.toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
        item.id.toString().includes(searchTerm.trim())) &&
        (planFilter === "All Plans" || item.plan === planFilter)
      )
    : mockPayments.filter((item) =>
        (item.productName.toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
        item.id.toString().includes(searchTerm.trim())) &&
        item.status === filter &&
        (planFilter === "All Plans" || item.plan === planFilter)
      );

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
        return "bg-green-100 text-green-700";
      case "Pending":
        return "bg-yellow-100 text-yellow-700";
      case "Failed":
        return "bg-red-100 text-red-700";
      default:
        return "";
    }
  };

  const handleCardClick = (id: number) => {
    setExpandedCardId(expandedCardId === id ? null : id);
  };

  return (
    <div className="flex-1 pl-60 pb-6 bg-white">
      {/* Header with Search and Company Name */}
      <div className="bg-white p-6 shadow flex justify-between items-center">
        <div className="relative w-96">
          <input
            type="text"
            placeholder="Search Ads"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border border-gray-500 w-full rounded-md p-2 pl-10 focus:outline-none"
          />
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        </div>
      </div>
      <div className="bg-white p-6 pt-2 shadow flex justify-between items-center">
        <h1 className="text-3xl font-semibold">Payment</h1>
      </div>

      {/* Filters */}
      <div className="bg-white p-1 pl-5 flex justify-between items-center">
        <div className="space-x-4">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as Status | "All")}
            className="bg-white border border-gray-300 rounded-md p-2"
          >
            <option value="All">All Status</option>
            <option value="Paid">Paid</option>
            <option value="Pending">Pending</option>
            <option value="Failed">Failed</option>
          </select>
          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
            className="bg-white border border-gray-300 rounded-md p-2"
          >
            <option value="All Plans">All Plans</option>
            <option value="Monthly">Monthly</option>
            <option value="Weekly">Weekly</option>
          </select>
        </div>
      </div>

      {/* Payment Cards */}
      <div className="bg-white p-6 grid grid-cols-3 gap-6">
        {currentPayments.length > 0 ? (
          currentPayments.map((item) => (
            <div
              key={item.id}
              className={`rounded-lg shadow-lg p-3 bg-gray-100 overflow-hidden cursor-pointer relative hover:scale-105 transition-all duration-300 ${expandedCardId === item.id ? 'h-auto' : 'h-32'}`}
              onClick={() => handleCardClick(item.id)}
            >
              {expandedCardId === item.id ? (
                <div className="flex flex-col space-y-2">
                  {/* Image and Basic Info */}
                  <div className="flex items-center">
                    <div className="w-28 bg-white flex-shrink-0 flex items-center justify-center p-2 rounded-lg">
                      <img
                        src={item.imageUrl}
                        alt={`${item.productName} image`}
                        className="w-20 h-20 object-contain"
                      />
                    </div>
                    <div className="ml-4 flex-grow">
                      <h3 className="text-lg font-semibold text-black">{item.productName}</h3>
                      <p className="text-sm text-gray-600">{item.plan} Plan</p>
                      <p className="text-sm font-bold text-[#3674B5] mt-1">P {parseFloat(item.amount.replace('$', '')).toFixed(0)}.000</p>
                    </div>
                  </div>
                 {/* Additional Details */}
                 <div className="text-sm text-gray-700 mt-2 pl-2 grid grid-cols-2 gap-2">
                  <p><strong>Amount:</strong> {parseFloat(item.amount.replace('$', '')).toFixed(0)}</p>
                  <p><strong>Mode of Payment:</strong> Gcash</p>
                  <p><strong>Bank Number:</strong> {item.bankNumber}</p>
                  <p><strong>Ad Type:</strong> {item.adType}</p>
                  <p><strong>Address:</strong> {item.address}</p>
                  </div>
                  <div className="flex justify-end mt-2">
                    <p className={`inline-block text-right pr-2 p-2 w-auto py-1 text-xs font-semibold rounded ${getStatusStyle(item.status)}`}>
                      {item.status} ID: {item.id}
                      </p>
                      </div>
                </div>
              ) : (
                <div className="flex items-center h-full">
                  {/* Image */}
                  <div className="rounded-lg w-28 bg-white flex-shrink-0 flex items-center justify-center p-2">
                    <img
                      src={item.imageUrl}
                      alt={`${item.productName} image`}
                      className="w-20 h-20 object-contain"
                    />
                  </div>
                  {/* Basic Info */}
                  <div className="ml-4 flex-grow flex flex-col justify-between h-full">
                    <div>
                      <h3 className="text-lg font-semibold text-black">{item.productName}</h3>
                      <p className="text-sm text-gray-600">{item.plan} Plan</p>
                    </div>
                    <div className="flex justify-between items-end">
                      <p className="text-sm font-bold text-[#3674B5] mt-4">P {parseFloat(item.amount.replace('$', '')).toFixed(0)}.000</p>
                      <span className={`w-16 text-center mt-4 inline-block px-2 py-1 text-xs font-semibold rounded ${getStatusStyle(item.status)}`}>
                        {item.status}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="col-span-3 text-center text-gray-500">
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
    </div>
  );
};

export default History;