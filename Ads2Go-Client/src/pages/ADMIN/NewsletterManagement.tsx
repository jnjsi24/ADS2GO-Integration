import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, RefreshCw, CircleOff, ChevronLeft, ChevronRight } from 'lucide-react';
import { AdminLoader } from "../../components/ProtectedRoute";

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
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [sortBy, setSortBy] = useState('Newest First');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);

  const filterOptions = [
    'All Subscribers',
    'Active Subscribers',
    'User Subscribers',
  ];

  const sortByOptions = ['Newest First', 'Oldest First', 'Alphabetical (A-Z)', 'Alphabetical (Z-A)'];

  // Pagination calculations
  const totalPages = Math.ceil(filteredSubscribers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedSubscribers = filteredSubscribers.slice(startIndex, endIndex);

  // Pagination handlers
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedFilter]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      setItemsPerPage(mobile ? 5 : 9);
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    fetchSubscribers();
  }, []);

  const fetchSubscribers = async () => {
    try {
      setLoading(true);
      setError(''); // Clear previous errors
      
      // Use environment variable or fallback to localhost for development
      // Strip /graphql if present since this is for REST API calls
      const baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
      const actualServerUrl = baseUrl.replace('/graphql', '').replace(/\/$/, '');
      
      console.log('🔍 Newsletter API Configuration:', {
        envUrl: process.env.REACT_APP_API_URL,
        finalUrl: actualServerUrl,
        usingFallback: !process.env.REACT_APP_API_URL,
        reason: process.env.REACT_APP_API_URL ? 'Using environment variable' : 'Using localhost fallback'
      });
      
      const fullUrl = `${actualServerUrl}/api/newsletter/subscribers?t=${Date.now()}`;
      console.log('📡 Fetching from URL:', fullUrl);
      
      const response = await fetch(fullUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10000)
      });
      
      console.log('📊 Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error:', errorText);
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log('✅ API Response:', data);
      
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
      console.error('❌ Fetch error:', err);
      
      let errorMessage = 'Network error';
      if (err instanceof Error) {
        if (err.name === 'TimeoutError') {
          errorMessage = 'Request timed out - server may be down';
        } else if (err.message.includes('Failed to fetch')) {
          errorMessage = 'Cannot connect to server - please check if the backend is running';
        } else if (err.message.includes('CORS')) {
          errorMessage = 'CORS error - server configuration issue';
        } else {
          errorMessage = err.message;
        }
      }
      
      setError(`Failed to fetch subscribers: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const applyFilter = (filter: string, subscribersData: Subscriber[], search: string, sort: string = sortBy) => {
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
    
    // Apply sorting
    filtered = filtered.sort((a, b) => {
      switch (sort) {
        case 'Newest First':
          return new Date(b.subscribedAt).getTime() - new Date(a.subscribedAt).getTime();
        case 'Oldest First':
          return new Date(a.subscribedAt).getTime() - new Date(b.subscribedAt).getTime();
        case 'Alphabetical (A-Z)':
          return a.email.localeCompare(b.email);
        case 'Alphabetical (Z-A)':
          return b.email.localeCompare(a.email);
        default:
          return 0;
      }
    });
    
    setFilteredSubscribers(filtered);
  };

  const handleFilterChange = (filter: string) => {
    setSelectedFilter(filter);
    applyFilter(filter, subscribers, searchTerm);
    setShowFilterDropdown(false);
  };

  const handleSearchChange = (term: string) => {
    setSearchTerm(term);
    applyFilter(selectedFilter, subscribers, term, sortBy);
  };

  const handleSortChange = (sort: string) => {
    setSortBy(sort);
    applyFilter(selectedFilter, subscribers, searchTerm, sort);
    setShowSortDropdown(false);
  };

  const handleUnsubscribe = async (email: string) => {
    setEmailToUnsubscribe(email);
    setShowUnsubscribeModal(true);
  };

  const confirmUnsubscribe = async () => {
    try {
      // Strip /graphql if present since this is for REST API calls
      const baseUrl = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace('/graphql', '').replace(/\/$/, '');
      const response = await fetch(`${baseUrl}/api/newsletter/unsubscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: emailToUnsubscribe }),
        signal: AbortSignal.timeout(10000)
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
      console.error('❌ Unsubscribe error:', err);
      alert('Failed to unsubscribe: ' + (err instanceof Error ? err.message : 'Network error'));
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
    return <AdminLoader />;
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
                <li>Backend server is not running or not accessible</li>
                <li>Network connectivity issues</li>
                <li>API endpoint not accessible</li>
                <li>Database connection issues</li>
                <li>CORS configuration problems</li>
              </ul>
            </div>
            <div className="text-sm text-blue-600 mb-4">
              <strong>Troubleshooting steps:</strong>
              <ul className="list-disc list-inside mt-2">
                <li>Check if the backend server is running: <code className="bg-gray-100 px-1 rounded">npm start</code> in the Ads2Go-Server directory</li>
                <li>Verify the server is accessible and the API URL is correctly configured</li>
                <li>Check browser console for detailed error messages</li>
                <li>Ensure the newsletter API endpoint exists on the backend</li>
              </ul>
            </div>
            <div className="flex space-x-4">
              <button
                onClick={fetchSubscribers}
                className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors duration-200"
              >
                Retry
              </button>
              <button
                onClick={() => {
                  // Show offline mode with empty data
                  setError('');
                  setSubscribers([]);
                  setFilteredSubscribers([]);
                  setStats({
                    total: 0,
                    active: 0,
                    inactive: 0,
                    userSubscribers: 0,
                    nonUserSubscribers: 0
                  });
                }}
                className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors duration-200"
              >
                Continue Offline
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen bg-gray-100 p-4 md:p-10 flex flex-col ${
        isMobile ? 'px-10 pl-28' : 'ml-60'
      }`}
    >
      <div className="max-w-7xl mx-auto w-full">
        {/* Mobile Header */}
        {isMobile && (
          <div className="flex items-center mb-4">
            <h1 className="text-xl pt-7 font-bold text-gray-800">
              Newsletter Management
            </h1>
          </div>
        )}

        {/* Header with Title and Filters */}
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 mb-6">
          {!isMobile && (
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-800">
              Newsletter Management
            </h1>
          )}
            <div className={`flex ${isMobile ? 'flex-col gap-3 w-full' : 'gap-1'}`}>
              <input
                type="text"
                className={`text-xs text-black rounded-md pl-5 py-3 ${isMobile ? 'w-full' : 'w-80'} shadow-md focus:outline-none bg-white`}
                placeholder="Search Subscribers"
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
              <div className={`relative ${isMobile ? 'w-full' : 'w-44'}`}>
                <button
                  onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                  className={`flex items-center justify-between w-full text-xs text-black rounded-md pl-6 pr-4 py-3 shadow-md focus:outline-none bg-white gap-2`}
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
                      className="absolute z-10 top-full mt-2 w-full rounded-md shadow-lg bg-white overflow-hidden"
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
              <div className={`relative ${isMobile ? 'w-full' : 'w-48'}`}>
                <button
                  onClick={() => setShowSortDropdown(!showSortDropdown)}
                  className={`flex items-center justify-between w-full text-xs text-black rounded-lg pl-6 pr-4 py-3 shadow-md focus:outline-none bg-white gap-2`}
                >
                  {sortBy}
                  <ChevronDown size={16} className={`transform transition-transform duration-200 ${showSortDropdown ? 'rotate-180' : 'rotate-0'}`} />
                </button>
                <AnimatePresence>
                  {showSortDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="absolute z-10 top-full mt-2 w-full rounded-lg shadow-lg bg-white overflow-hidden"
                    >
                      {sortByOptions.map((option) => (
                        <button
                          key={option}
                          onClick={() => handleSortChange(option)}
                          className="block w-full text-left px-4 py-2 text-xs ml-2 text-gray-700 hover:bg-gray-100 transition-colors duration-150"
                        >
                          {option}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div
            className={`flex mb-6 ${
              isMobile
                ? 'flex-row justify-between gap-2' // one row on mobile
                : 'justify-end space-x-2'
            }`}
          >
            {/* Refresh Button */}
            <button
              onClick={fetchSubscribers}
              className={`flex items-center justify-center gap-2 bg-[#3674B5] text-xs text-white px-3 py-3 rounded-md hover:bg-[#2c5a8a] transition-colors duration-200 ${
                isMobile ? 'text-xs flex-[0.2]' : ''
              }`}
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>

            {/* Email All Active Subscribers Button */}
            <button
              onClick={() =>
                window.open(
                  'mailto:' +
                    filteredSubscribers
                      .filter((s) => s.isActive)
                      .map((s) => s.email)
                      .join(',')
                )
              }
              className={`flex items-center justify-center gap-2 bg-green-600 text-xs text-white px-3 py-3 rounded-md hover:bg-green-700 transition-colors duration-200 ${
                isMobile ? 'text-xs flex-[0.8]' : ''
              }`}
              disabled={stats.active === 0}
            >
              Email All Active Subscribers
            </button>
          </div>
        </div>

        <div className="rounded-lg overflow-hidden">
          {error && (
            <div className="px-6 py-4 bg-red-50 text-red-600">
              {error}
            </div>
          )}

          <div className="rounded-md mb-4 overflow-hidden">
            {/* Header - Hidden on mobile */}
            {!isMobile && (
              <div className="grid grid-cols-12 gap-1 px-4 py-2 text-sm font-semibold text-gray-600 bg-gray-100">
                <div className="col-span-3">Email</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-2">Source</div>
                <div className="col-span-2">Subscribed</div>
                <div className="col-span-1">Emails Sent</div>
                <div className="col-span-2 text-center">Actions</div>
              </div>
            )}

            {/* Rows */}
            <div className="flex-1">
              {paginatedSubscribers.map((subscriber) => (
                <div key={subscriber._id} className="bg-white mb-3 rounded-lg shadow-md">
                  {isMobile ? (
                    <div className="p-4">
                      {/* Email + Subscribed date */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div>
                            <div className="font-semibold text-gray-800 text-sm">
                              {subscriber.email}
                            </div>
                            {/* ✅ Removed "Subscribed:" text */}
                            <div className="text-xs text-gray-500 truncate max-w-[150px]">
                              {formatDate(subscriber.subscribedAt)}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Status + Source Badges */}
                      <div className="grid grid-cols-2 gap-2 text-sm text-black mb-3">
                        <div>
                          <div className="font-medium text-xs">Status</div>
                          <span
                            className={`inline-block px-2 py-1 text-xs font-semibold rounded-full ${
                              subscriber.isActive
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {subscriber.isActive ? "Active" : "Inactive"}
                          </span>
                        </div>
                        <div>
                          <div className="font-medium text-xs">Source</div>
                          <span
                            className={`inline-block px-2 py-1 text-xs font-semibold rounded-full ${
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
                      </div>

                      {/* ✅ Emails Sent (left) + Unsubscribe (right) */}
                      <div className="flex items-center justify-between mt-2">
                        <div className="text-xs text-gray-700">
                          Emails Sent: <span className="font-semibold">{subscriber.emailCount}</span>
                        </div>
                        {subscriber.isActive && (
                          <button
                            onClick={() => handleUnsubscribe(subscriber.email)}
                            className="flex items-center text-red-700 px-3 py-1 rounded border border-red-200 hover:bg-red-50 text-xs"
                          >
                            <CircleOff size={14} className="mr-1" />
                            <span>Unsubscribe</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-12 items-center px-5 py-6 text-sm hover:bg-gray-100 transition-colors">
                      <div className="col-span-3 truncate font-medium text-gray-900">
                        {subscriber.email}
                      </div>
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
                      <div className="col-span-2 text-gray-500">
                        {formatDate(subscriber.subscribedAt)}
                      </div>
                      <div className="col-span-1 text-gray-500 text-center">
                        {subscriber.emailCount}
                      </div>
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
                  )}
                </div>
              ))}

              {filteredSubscribers.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No subscribers found
                </div>
              )}
            </div>
          </div>

          {/* Pagination */}
          <div className="mt-auto flex justify-center py-4">
            <div className="flex items-center space-x-1 sm:space-x-2">
              <button
                onClick={handlePreviousPage}
                disabled={currentPage === 1}
                className="flex items-center px-2 sm:px-3 py-1 text-sm rounded font-semibold hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline">Previous</span>
              </button>

              <div className="flex space-x-1">
                {(() => {
                  const pages = [];
                  const maxVisiblePages = isMobile ? 1 : 3;
                  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
                  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

                  if (endPage - startPage + 1 < maxVisiblePages) {
                    startPage = Math.max(1, endPage - maxVisiblePages + 1);
                  }

                  for (let i = startPage; i <= endPage; i++) {
                    pages.push(
                      <button
                        key={i}
                        onClick={() => handlePageChange(i)}
                        className={`px-2 sm:px-3 py-1 text-sm rounded ${
                          currentPage === i
                            ? "border border-gray-300 text-black"
                            : "text-gray-700 hover:border border-gray-300"
                        }`}
                      >
                        {i}
                      </button>
                    );
                  }

                  if (endPage < totalPages && !isMobile) {
                    pages.push(
                      <span key="ellipsis" className="px-2 text-gray-500">
                        …
                      </span>
                    );
                  }

                  return pages;
                })()}
              </div>

              <button
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
                className="flex items-center px-2 sm:px-3 py-1 text-sm rounded font-semibold hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="w-4 h-4 ml-1" />
              </button>
            </div>
          </div>

          {showUnsubscribeModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className={`bg-white rounded-lg ${isMobile ? 'p-4 w-full max-w-[90vw]' : 'p-6 w-96'}`}>
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