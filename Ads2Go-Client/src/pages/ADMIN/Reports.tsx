import React, { useState } from 'react';
import { Search } from 'lucide-react';
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
    amount: 50.00,
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
    amount: 120.00,
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
    amount: 30.00,
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
    amount: 200.00,
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
    amount: 75.00,
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
    <div className="pt-10 pb-10 pl-72 p-8 bg-[#f9f9fc]">
      <div className="bg-[#f9f9fc] w-full">
        {/* Header with Dropdown Title and Add New Button */}
        <div className="flex justify-between items-center mb-6">
          <p className="px-3 py-1 text-2xl font-bold text-gray-800 focus:outline-none"> Reports </p>
          <button
            className="px-4 py-2 bg-[#3674B5] text-white rounded-md hover:bg-[#578FCA] hover:scale-105 transition-all duration-300"
          >
            Add New Report
          </button>
        </div>

        {/* Search Bar and Filters */}
        <div className="flex justify-between items-center mb-4">
          <input
            type="text"
            className="border rounded px-3 py-1 text-sm w-64"
            placeholder="Search by ID, Title, or User"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <div className="flex space-x-2">
            <select
              className="border rounded px-3 py-1 text-sm"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as TransactionStatus)}
            >
              <option value="all">All Status</option>
              <option value="Paid">Paid</option>
              <option value="Failed">Failed</option>
              <option value="Refunded">Refunded</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-auto rounded-md mb-4">
          <table className="min-w-full text-sm">
            <thead className="bg-[#3674B5]">
              <tr>
                <th className="px-2 py-2 text-left text-sm font-semibold text-white w-32">
                  <div className="flex justify-center">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="mr-1"
                      />
                      Select All
                    </label>
                  </div>
                </th>
                <th className="px-2 py-2 text-left text-sm font-semibold text-white">Title</th>
                <th className="px-4 py-2 text-left text-sm font-semibold text-white">User</th>
                <th className="px-4 py-2 text-left text-sm font-semibold text-white">Status</th>
                <th className="px-4 py-2 text-left text-sm font-semibold text-white">Plan</th>
                <th className="px-4 py-2 text-left text-sm font-semibold text-white">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-4 text-gray-500">
                    No transactions found.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => (
                  <React.Fragment key={tx.id}>
                    <tr
                      className="bg-white border-t border-gray-300 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleRowClick(tx.id)}
                    >
                      <td className="px-2 py-3">
                        <div className="flex justify-center">
                          <input
                            type="checkbox"
                            className="mr-1"
                          />
                        </div>
                      </td>
                      <td className="px-2 py-3">
                        <span className="font-medium">{tx.title}</span>
                      </td>
                      <td className="px-4 py-3">{tx.user}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            tx.status === 'Paid' ? 'bg-green-200 text-green-800' :
                            tx.status === 'Failed' ? 'bg-red-200 text-red-800' :
                            'bg-yellow-200 text-yellow-800'
                          }`}
                        >
                          {tx.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">{tx.plan}</td>
                      <td className="px-4 py-3 flex space-x-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(tx.id); }}
                          className="bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 flex items-center"
                        >
                          <TrashIcon className="w-4 h-4 mr-1" /> Delete
                        </button>
                      </td>
                    </tr>
                    {expandedRow === tx.id && (
                      <tr className="bg-gray-50">
                        <td colSpan={6} className="p-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                            <div><strong>Ad Type:</strong> {tx.adType}</div>
                            <div><strong>Materials:</strong> {tx.materials}</div>
                            <div><strong>MOP:</strong> {tx.mop}</div>
                            <div><strong>Date:</strong> {tx.date}</div>
                            <div><strong>Amount:</strong> ${tx.amount.toFixed(2)}</div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Found: {filteredTransactions.length} transaction(s)</span>
          <div className="flex space-x-2">
            <button className="px-4 py-2 border border-green-600 text-green-600 rounded hover:bg-green-50 text-sm">
              Export to Excel
            </button>
            <div className="flex items-center space-x-2">
              <button className="px-2 py-1 border rounded text-sm"></button>
              <span className="px-2 py-1">1 2 3</span>
              <button className="px-2 py-1 border rounded text-sm"></button>
              <span className="text-sm text-gray-600">19 20</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatusBadge = ({ status }: { status: TransactionStatus }) => {
  const base = 'px-2 py-1 rounded-full text-xs font-medium';
  const styles = {
    Paid: 'bg-green-100 text-green-800',
    Failed: 'bg-red-100 text-red-800',
    Refunded: 'bg-yellow-100 text-yellow-800',
  };
  return <span className={`${base} ${styles[status as keyof typeof styles]}`}>{status}</span>;
};

export default Reports;