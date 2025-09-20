import React, { useState } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import { TrashIcon } from '@heroicons/react/24/outline';

type TransactionStatus = 'Paid' | 'Failed' | 'Refunded' | 'all';

interface Transaction {
  id: number;
  title: string;
  user: string;
  status: TransactionStatus;
  plan: string;
  adType: string;
  materials: string;
  mop: string;
  date: string;
  amount: number;
}

const sampleTransactions: Transaction[] = [
  {
    id: 1001,
    title: 'Drive Clean Promo',
    user: 'Juan Dela Cruz',
    status: 'Paid',
    plan: 'Basic Plan',
    adType: 'Banner',
    materials: 'Image, Video',
    mop: 'Credit Card',
    date: '2025-05-01',
    amount: 50.0,
  },
  {
    id: 1002,
    title: 'Urban Threads Campaign',
    user: 'Maria Santos',
    status: 'Failed',
    plan: 'Premium Plan',
    adType: 'Video Ad',
    materials: 'Video',
    mop: 'PayPal',
    date: '2025-05-02',
    amount: 120.0,
  },
  {
    id: 1003,
    title: 'Fresh Harvest Tour',
    user: 'Pedro Reyes',
    status: 'Refunded',
    plan: 'Basic Plan',
    adType: 'Banner',
    materials: 'Image',
    mop: 'GCash',
    date: '2025-05-03',
    amount: 30.0,
  },
  {
    id: 1004,
    title: 'Beach Bliss Offers',
    user: 'Ana Garcia',
    status: 'Paid',
    plan: 'Monthly Plan',
    adType: 'Video Ad',
    materials: 'Video',
    mop: 'Bank Transfer',
    date: '2025-05-04',
    amount: 200.0,
  },
  {
    id: 1005,
    title: 'eRide Makati Launch',
    user: 'Luis Mendoza',
    status: 'Failed',
    plan: 'Weekly Plan',
    adType: 'Banner',
    materials: 'Image',
    mop: 'PayPal',
    date: '2025-05-05',
    amount: 75.0,
  },
];

const Reports: React.FC = () => {
  const [filterStatus, setFilterStatus] = useState<TransactionStatus>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const filteredTransactions = sampleTransactions.filter((tx) => {
    const matchStatus = filterStatus === 'all' || tx.status === filterStatus;
    const matchSearch = searchTerm
      ? tx.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tx.id.toString().includes(searchTerm) ||
        tx.user.toLowerCase().includes(searchTerm.toLowerCase())
      : true;
    return matchStatus && matchSearch;
  });

  const handleRowClick = (id: number) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  const handleDelete = (id: number) => {
    if (window.confirm('Are you sure you want to delete this transaction?')) {
      // Placeholder: Implement deletion logic if needed
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 pl-64 pr-5 p-10">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Reports</h1>
        <div className="flex flex-col items-end gap-3">
          <div className="flex gap-2">
            <input
              type="text"
              className="text-xs text-black rounded-xl pl-5 py-3 w-80 shadow-md focus:outline-none bg-white"
              placeholder="Search by ID, Title, or User"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <div className="relative w-40">
              <select
                className="appearance-none w-full text-xs text-black rounded-xl pl-5 pr-10 py-3 shadow-md focus:outline-none bg-white"
                value={filterStatus}
                onChange={(e) =>
                  setFilterStatus(e.target.value as TransactionStatus)
                }
              >
                <option value="all">All Status</option>
                <option value="Paid">Paid</option>
                <option value="Failed">Failed</option>
                <option value="Refunded">Refunded</option>
              </select>
              <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add New Report Button */}
      <div className="flex justify-end mb-6">
        <button className="py-3 bg-[#3674B5] text-xs text-white rounded-xl w-40 hover:bg-[#578FCA] hover:scale-105 transition-all duration-300 flex items-center justify-center gap-2">
          <Plus size={16} />
          Add New Report
        </button>
      </div>

      {/* Table Header */}
      <div className="grid grid-cols-12 px-4 py-3 text-sm font-semibold text-gray-600">
        <div className="col-span-1 flex justify-center">
          <input type="checkbox" />
        </div>
        <div className="col-span-3">Title</div>
        <div className="col-span-2">User</div>
        <div className="col-span-2">Status</div>
        <div className="col-span-2">Plan</div>
        <div className="col-span-2 text-center">Actions</div>
      </div>

      {/* Rows */}
      {filteredTransactions.length === 0 ? (
        <div className="text-center py-10 text-gray-500">
          No transactions found.
        </div>
      ) : (
        filteredTransactions.map((tx) => (
          <div key={tx.id} className="bg-white mb-3 rounded-lg shadow-md">
            {/* Main Row */}
            <div
              className="grid grid-cols-12 items-center px-5 py-5 text-sm hover:bg-gray-100 transition-colors cursor-pointer"
              onClick={() => handleRowClick(tx.id)}
            >
              {/* Checkbox */}
              <div className="col-span-1 flex justify-center">
                <input type="checkbox" />
              </div>

              {/* Title */}
              <div className="col-span-3 truncate font-medium" title={tx.title}>
                {tx.title}
              </div>

              {/* User */}
              <div className="col-span-2 truncate" title={tx.user}>
                {tx.user}
              </div>

              {/* Status */}
              <div className="col-span-2">
                <span
                  className={`px-2 py-1 text-xs font-medium rounded-full ${
                    tx.status === 'Paid'
                      ? 'bg-green-200 text-green-800'
                      : tx.status === 'Failed'
                      ? 'bg-red-200 text-red-800'
                      : 'bg-yellow-200 text-yellow-800'
                  }`}
                >
                  {tx.status}
                </span>
              </div>

              {/* Plan */}
              <div className="col-span-2 truncate">{tx.plan}</div>

              {/* Actions */}
              <div className="col-span-2 flex items-center justify-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(tx.id);
                  }}
                  className="text-red-500 text-md hover:text-red-700 flex items-center"
                >
                  <TrashIcon className="w-4 h-4 mr-1" />
                  
                </button>
              </div>
            </div>

            {/* Expanded Row */}
            {expandedRow === tx.id && (
              <div className="bg-gray-50 px-6 py-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <strong>Ad Type:</strong> {tx.adType}
                  </div>
                  <div>
                    <strong>Materials:</strong> {tx.materials}
                  </div>
                  <div>
                    <strong>MOP:</strong> {tx.mop}
                  </div>
                  <div>
                    <strong>Date:</strong> {tx.date}
                  </div>
                  <div>
                    <strong>Amount:</strong> ${tx.amount.toFixed(2)}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))
      )}

      {/* Footer */}
      <div className="flex justify-between items-center mt-6">
        <span className="text-sm text-gray-600">
          Found: {filteredTransactions.length} transaction(s)
        </span>
        <div className="flex space-x-2">
          <button className="px-4 py-2 border border-green-600 text-green-600 rounded hover:bg-green-50 text-sm">
            Export to Excel
          </button>
          <div className="flex items-center space-x-2">
            <button className="px-2 py-1 border rounded text-sm"></button>
            <span className="px-2 py-1">1 2 3</span>
            <button className="px-2 py-1 border rounded text-sm"></button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;
