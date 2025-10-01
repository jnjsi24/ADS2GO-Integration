import React, { useState, useEffect } from 'react';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, RefreshCw, CircleOff } from 'lucide-react';

interface Subscriber {
  _id: string;
  email: string;
  subscribedAt: string;
  isActive: boolean;
  source: string;
  emailCount: number;
  lastEmailSent?: string;
}

const NewsletterManagement: React.FC = () => {
  const { admin } = useAdminAuth();
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [filteredSubscribers, setFilteredSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    userSubscribers: 0,
    nonUserSubscribers: 0
  });
  const [showUnsubscribeModal, setShowUnsubscribeModal] = useState(false);
  const [emailToUnsubscribe, setEmailToUnsubscribe] = useState('');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<string>('All Subscribers');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const filterOptions = [
    'All Subscribers',
    'Active Subscribers',
    'User Subscribers',
    'Non-User Subscribers',
    'Unsubscribed'
  ];

  useEffect(() => {
    fetchSubscribers();
  }, []);

  const fetchSubscribers = async () => {
    try {
      setLoading(true);
      setError('');
      const apiUrl = process.env.REACT_APP_API_URL;
      if (!apiUrl) {
        setError('API URL not configured');
        return;
      }
      const fullUrl = `${apiUrl}/api/newsletter/subscribers?t=${Date.now()}`;
      
      console.log('Fetching subscribers from:', fullUrl);
      
      const response = await fetch(fullUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', errorText);
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log('API Response:', data);
      
      if (data.success) {
        const subscribers = data.subscribers || [];
        setSubscribers(subscribers);
        applyFilter(selectedFilter, subscribers, searchTerm);
        
        const activeCount = subscribers.filter((sub: Subscriber) => sub.isActive).length;
        const inactiveCount = subscribers.filter((sub: Subscriber) => !sub.isActive).length;
        
        const userSubscribers = subscribers.filter((sub: Subscriber) => 
          sub.isActive && (sub.source === 'registration' || sub.source === 'existing_user_migration')
        ).length;
        const nonUserSubscribers = subscribers.filter((sub: Subscriber) => 
          sub.isActive && !['registration', 'existing_user_migration'].includes(sub.source)
        ).length;
        
        setStats({
          total: subscribers.length,
          active: activeCount,
          inactive: inactiveCount,
          userSubscribers,
          nonUserSubscribers
        });
      } else {
        setError(`Failed to fetch subscribers: ${data.message || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Fetch error:', err);
      setError(`Failed to fetch subscribers: ${err instanceof Error ? err.message : 'Network error'}`);
    } finally {
      setLoading(false);
    }
  };

  const applyFilter = (filter: string, subscribersData: Subscriber[], search: string) => {
    let filtered = subscribersData;
    switch (filter) {
      case 'Active Subscribers':
        filtered = subscribersData.filter(sub => sub.isActive);
        break;
      case 'User Subscribers':
        filtered = subscribersData.filter(sub => 
          sub.isActive && (sub.source === 'registration' || sub.source === 'existing_user_migration')
        );
        break;
      case 'Non-User Subscribers':
        filtered = subscribersData.filter(sub => 
          sub.isActive && !['registration', 'existing_user_migration'].includes(sub.source)
        );
        break;
      case 'Unsubscribed':
        filtered = subscribersData.filter(sub => !sub.isActive);
        break;
      case 'All Subscribers':
      default:
        filtered = subscribersData;
        break;
    }
    if (search) {
      filtered = filtered.filter(sub => 
        sub.email.toLowerCase().includes(search.toLowerCase())
      );
    }
    setFilteredSubscribers(filtered);
  };

  const handleFilterChange = (filter: string) => {
    setSelectedFilter(filter);
    applyFilter(filter, subscribers, searchTerm);
    setShowFilterDropdown(false);
  };

  const handleSearchChange = (term: string) => {
    setSearchTerm(term);
    applyFilter(selectedFilter, subscribers, term);
  };

  const handleUnsubscribe = async (email: string) => {
    setEmailToUnsubscribe(email);
    setShowUnsubscribeModal(true);
  };

  const confirmUnsubscribe = async () => {
    try {
      const apiUrl = process.env.REACT_APP_API_URL;
      if (!apiUrl) {
        alert('API URL not configured');
        return;
      }
      const response = await fetch(`${apiUrl}/api/newsletter/unsubscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: emailToUnsubscribe }),
      });

      const data = await response.json();
      
      if (data.success) {
        fetchSubscribers();
        setShowUnsubscribeModal(false);
        setEmailToUnsubscribe('');
      } else {
        alert('Failed to unsubscribe: ' + data.message);
      }
    } catch (err) {
      alert('Failed to unsubscribe');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 pl-60 pr-5 p-10">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-[#3674B5] mb-2">Newsletter Management</h1>
            <p className="text-gray-600">Manage newsletter subscribers and send updates</p>
          </div>
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="text-lg mb-2">Loading newsletter subscribers...</div>
              <div className="text-sm text-gray-500">Please check the browser console for any errors</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 pl-60 pr-5 p-10">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-[#3674B5] mb-2">Newsletter Management</h1>
            <p className="text-gray-600">Manage newsletter subscribers and send updates</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-center">
              <div className="text-red-600 font-semibold text-lg mb-2">Error Loading Newsletter Data</div>
            </div>
            <div className="text-red-700 mb-4">{error}</div>
            <div className="text-sm text-red-600 mb-4">
              <strong>Possible causes:</strong>
              <ul className="list-disc list-inside mt-2">
                <li>Server is not running on {process.env.REACT_APP_API_URL || 'API URL not configured'}</li>
                <li>Network connectivity issues</li>
                <li>API endpoint not accessible</li>
                <li>Database connection issues</li>
              </ul>
            </div>
            <button
              onClick={fetchSubscribers}
              className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors duration-200"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 pl-60 pr-5 p-10">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-[#3674B5]">Newsletter Management</h1>
            <div className="flex space-x-4">
              <input
                type="text"
                className="text-xs text-black rounded-lg pl-5 py-3 w-80 shadow-md focus:outline-none bg-white"
                placeholder="Search Subscribers"
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
              <div className="relative w-48">
                <button
                  onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                  className="flex items-center justify-between w-full text-xs text-black rounded-lg pl-6 pr-4 py-3 shadow-md focus:outline-none bg-white gap-2"
                >
                  {selectedFilter}
                  <ChevronDown size={16} className={`transform transition-transform duration-200 ${showFilterDropdown ? 'rotate-180' : 'rotate-0'}`} />
                </button>
                <AnimatePresence>
                  {showFilterDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="absolute z-10 top-full mt-2 w-full rounded-lg shadow-lg bg-white overflow-hidden"
                    >
                      {filterOptions.map((filter) => (
                        <button
                          key={filter}
                          onClick={() => handleFilterChange(filter)}
                          className="block w-full text-left px-4 py-2 text-xs ml-2 text-gray-700 hover:bg-gray-100 transition-colors duration-150"
                        >
                          {filter}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
          <div className="flex justify-end space-x-4">
            <button
              onClick={fetchSubscribers}
              className="flex items-center gap-2 bg-[#3674B5] text-white px-4 py-2 rounded-md hover:bg-[#2c5a8a] transition-colors duration-200"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh List
            </button>
            <button
              onClick={() =>
                window.open(
                  "mailto:" +
                    filteredSubscribers
                      .filter((s) => s.isActive)
                      .map((s) => s.email)
                      .join(",")
                )
              }
              className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors duration-200"
              disabled={stats.active === 0}
            >
              Email All Active Subscribers
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-5 gap-4 mb-8">
          <div className="bg-blue-50 rounded-lg p-6">
            <div className="flex items-center">
              <div className="text-3xl font-bold text-blue-600">{stats.total}</div>
              <div className="ml-4">
                <div className="text-sm text-gray-600">Total Subscribers</div>
                <div className="text-xs text-gray-500">All time</div>
              </div>
            </div>
          </div>
          <div className="bg-green-50 rounded-lg p-6">
            <div className="flex items-center">
              <div className="text-3xl font-bold text-green-600">{stats.active}</div>
              <div className="ml-4">
                <div className="text-sm text-gray-600">Active Subscribers</div>
                <div className="text-xs text-gray-500">Currently subscribed</div>
              </div>
            </div>
          </div>
          <div className="bg-purple-50 rounded-lg p-6">
            <div className="flex items-center">
              <div className="text-3xl font-bold text-purple-600">{stats.userSubscribers}</div>
              <div className="ml-4">
                <div className="text-sm text-gray-600">User Subscribers</div>
                <div className="text-xs text-gray-500">Website users</div>
              </div>
            </div>
          </div>
          <div className="bg-orange-50 rounded-lg p-6">
            <div className="flex items-center">
              <div className="text-3xl font-bold text-orange-600">{stats.nonUserSubscribers}</div>
              <div className="ml-4">
                <div className="text-sm text-gray-600">Non-User Subscribers</div>
                <div className="text-xs text-gray-500">Landing page only</div>
              </div>
            </div>
          </div>
          <div className="bg-red-50 rounded-lg p-6">
            <div className="flex items-center">
              <div className="text-3xl font-bold text-red-600">{stats.inactive}</div>
              <div className="ml-4">
                <div className="text-sm text-gray-600">Unsubscribed</div>
                <div className="text-xs text-gray-500">No longer active</div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg overflow-hidden">
          {error && (
            <div className="px-6 py-4 bg-red-50 text-red-600">
              {error}
            </div>
          )}

          <div className="rounded-md mb-4 overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-12 gap-1 px-4 py-2 text-sm font-semibold text-gray-600 bg-gray-100">
              <div className="col-span-3">Email</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2">Source</div>
              <div className="col-span-2">Subscribed</div>
              <div className="col-span-1">Emails Sent</div>
              <div className="col-span-2 text-center">Actions</div>
            </div>

            {/* Rows */}
            {filteredSubscribers.map((subscriber) => (
              <div key={subscriber._id} className="bg-white mb-3 rounded-lg shadow-md">
                <div className="grid grid-cols-12 items-center px-5 py-6 text-sm hover:bg-gray-100 transition-colors">
                  {/* Email */}
                  <div className="col-span-3 truncate font-medium text-gray-900">
                    {subscriber.email}
                  </div>

                  {/* Status */}
                  <div className="col-span-2">
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        subscriber.isActive
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {subscriber.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>

                  {/* Source */}
                  <div className="col-span-2">
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        subscriber.source === "registration" ||
                        subscriber.source === "existing_user_migration"
                          ? "bg-purple-100 text-purple-800"
                          : "bg-orange-100 text-orange-800"
                      }`}
                    >
                      {subscriber.source === "registration"
                        ? "USER REGISTRATION"
                        : subscriber.source === "existing_user_migration"
                        ? "EXISTING USER"
                        : subscriber.source === "landing_page"
                        ? "LANDING PAGE"
                        : subscriber.source === "contact_form"
                        ? "CONTACT FORM"
                        : subscriber.source === "manual"
                        ? "MANUAL"
                        : subscriber.source.replace("_", " ").toUpperCase()}
                    </span>
                  </div>

                  {/* Subscribed Date */}
                  <div className="col-span-2 text-gray-500">
                    {formatDate(subscriber.subscribedAt)}
                  </div>

                  {/* Email Count */}
                  <div className="col-span-1 text-gray-500 text-center">
                    {subscriber.emailCount}
                  </div>

                  {/* Actions */}
                  <div
                    className="col-span-2 flex justify-center gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {subscriber.isActive && (
                      <button
                      onClick={() => handleUnsubscribe(subscriber.email)}
                      className="group flex items-center text-red-700 rounded-md overflow-hidden h-6 w-7 hover:w-28 transition-[width] duration-300"
                    >
                      <CircleOff className="w-4 h-4 flex-shrink-0 mx-auto ml-1.5 group-hover:ml-1 transition-all duration-300" />
                      <span className="opacity-0 group-hover:opacity-100 ml-1 group-hover:mr-3 whitespace-nowrap text-xs transition-all duration-300">
                        Unsubscribe
                      </span>
                    </button>                    
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>


          {filteredSubscribers.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No subscribers found
            </div>
          )}
        </div>

        {showUnsubscribeModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-96">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Confirm Unsubscribe</h3>
              <p className="text-gray-600 mb-6">
                Are you sure you want to unsubscribe <strong>{emailToUnsubscribe}</strong> from the newsletter?
              </p>
              <div className="flex space-x-4">
                <button
                  onClick={confirmUnsubscribe}
                  className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors duration-200"
                >
                  Yes, Unsubscribe
                </button>
                <button
                  onClick={() => {
                    setShowUnsubscribeModal(false);
                    setEmailToUnsubscribe('');
                  }}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 transition-colors duration-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NewsletterManagement;