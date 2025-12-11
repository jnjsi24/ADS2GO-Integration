import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, RefreshCw, CircleOff, ChevronLeft, ChevronRight, X, Mail, Upload, Loader, Send, Image as ImageIcon } from 'lucide-react';
import { AdminLoader } from "../../components/ProtectedRoute";
import { useToast, ToastContainer } from "../../components/ToastNotification";

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
  const { toasts, addToast, removeToast } = useToast();
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
  
  // Refs for dropdown click-outside handling
  const filterDropdownRef = useRef<HTMLDivElement>(null);
  const sortDropdownRef = useRef<HTMLDivElement>(null);
  
  // Bulk actions state
  const [selectedSubscribers, setSelectedSubscribers] = useState<string[]>([]);
  const [showBulkUnsubscribeModal, setShowBulkUnsubscribeModal] = useState(false);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);

  // Email compose modal state
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [emailImage, setEmailImage] = useState<File | null>(null);
  const [emailImagePreview, setEmailImagePreview] = useState<string | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [sendToAllActive, setSendToAllActive] = useState(false);

  const filterOptions = [
    'All Subscribers',
    'Active',
    'Inactive',
    'via Registration',
    'via Contact Form'
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
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Click outside handler for dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target as Node)) {
        setShowFilterDropdown(false);
      }
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target as Node)) {
        setShowSortDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
          sub.source === 'registration'
        ).length;
        const nonUserSubscribers = subscribers.filter((sub: Subscriber) => 
          sub.source === 'contact_form'
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
      case 'Active':
        filtered = subscribersData.filter(sub => sub.isActive);
        break;
      case 'Inactive':
        filtered = subscribersData.filter(sub => !sub.isActive);
        break;
      case 'via Registration':
        filtered = subscribersData.filter(sub => 
          sub.source === 'registration'
        );
        break;
      case 'via Contact Form':
        filtered = subscribersData.filter(sub => 
          sub.source === 'contact_form'
        );
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

  // Handle image selection and preview
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        addToast({
          type: 'error',
          title: 'Invalid File Type',
          message: 'Please select an image file',
          duration: 4000
        });
        return;
      }
      
      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        addToast({
          type: 'error',
          title: 'File Too Large',
          message: 'Image size must be less than 5MB',
          duration: 4000
        });
        return;
      }

      setEmailImage(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setEmailImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Upload image to server
  const uploadNewsletterImage = async () => {
    if (!emailImage) return null;

    try {
      const formData = new FormData();
      formData.append('image', emailImage);

      const baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
      const actualServerUrl = baseUrl.replace('/graphql', '').replace(/\/$/, '');
      
      const response = await fetch(`${actualServerUrl}/api/newsletter/upload-image`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        console.log('✅ Image uploaded:', data.imageUrl);
        return data.imageUrl;
      } else {
        throw new Error(data.message || 'Failed to upload image');
      }
    } catch (error) {
      console.error('❌ Image upload error:', error);
      throw error;
    }
  };

  // Send newsletter email
  const handleSendNewsletter = async () => {
    try {
      // Validation
      if (!emailSubject.trim()) {
        addToast({
          type: 'error',
          title: 'Validation Error',
          message: 'Please enter a subject',
          duration: 4000
        });
        return;
      }

      if (!emailMessage.trim()) {
        addToast({
          type: 'error',
          title: 'Validation Error',
          message: 'Please enter a message',
          duration: 4000
        });
        return;
      }

      if (!sendToAllActive && selectedSubscribers.length === 0) {
        addToast({
          type: 'error',
          title: 'Validation Error',
          message: 'Please select at least one subscriber or choose "All Active Subscribers"',
          duration: 4000
        });
        return;
      }

      setIsSendingEmail(true);

      // Upload image if selected
      let imageUrl = null;
      if (emailImage) {
        imageUrl = await uploadNewsletterImage();
      }

      // Prepare request data
      const requestData = {
        subject: emailSubject,
        message: emailMessage,
        imageUrl,
        sendToAllActive,
        subscriberIds: sendToAllActive ? [] : selectedSubscribers
      };

      // Send email
      const baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
      const actualServerUrl = baseUrl.replace('/graphql', '').replace(/\/$/, '');
      
      const response = await fetch(`${actualServerUrl}/api/newsletter/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
      });

      const data = await response.json();

      if (data.success) {
        addToast({
          type: 'success',
          title: 'Success!',
          message: `Newsletter sent successfully to ${data.recipientCount} subscriber(s)!`,
          duration: 5000
        });
        
        // Close modal and reset form
        setIsEmailModalOpen(false);
        setEmailSubject('');
        setEmailMessage('');
        setEmailImage(null);
        setEmailImagePreview(null);
        setUploadedImageUrl(null);
        setSelectedSubscribers([]);
        
        // Refresh subscribers to show updated lastEmailSent
        await fetchSubscribers();
      } else {
        throw new Error(data.message || 'Failed to send newsletter');
      }
    } catch (error) {
      console.error('❌ Newsletter send error:', error);
      addToast({
        type: 'error',
        title: 'Send Failed',
        message: `Failed to send newsletter: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: 5000
      });
    } finally {
      setIsSendingEmail(false);
    }
  };

  // Open email modal
  const handleOpenEmailModal = (allActive: boolean) => {
    setSendToAllActive(allActive);
    setIsEmailModalOpen(true);
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
        addToast({
          type: 'success',
          title: 'Success!',
          message: 'Subscriber unsubscribed successfully',
          duration: 3000
        });
      } else {
        addToast({
          type: 'error',
          title: 'Unsubscribe Failed',
          message: 'Failed to unsubscribe: ' + data.message,
          duration: 5000
        });
      }
    } catch (err) {
      console.error('❌ Unsubscribe error:', err);
      addToast({
        type: 'error',
        title: 'Unsubscribe Failed',
        message: 'Failed to unsubscribe: ' + (err instanceof Error ? err.message : 'Network error'),
        duration: 5000
      });
    }
  };

  // Bulk action handlers
  const handleSubscriberSelect = (id: string) => {
    setSelectedSubscribers(prev =>
      prev.includes(id)
        ? prev.filter(subId => subId !== id)
        : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    // Only select active subscribers
    const currentPageIds = paginatedSubscribers
      .filter(sub => sub.isActive)
      .map(sub => sub._id);
    const allCurrentPageSelected = currentPageIds.every(id => selectedSubscribers.includes(id));
    
    if (allCurrentPageSelected) {
      // Deselect only items from current page
      setSelectedSubscribers(prev => prev.filter(id => !currentPageIds.includes(id)));
    } else {
      // Add current page items to existing selection
      setSelectedSubscribers(prev => {
        const newSelection = [...prev];
        currentPageIds.forEach(id => {
          if (!newSelection.includes(id)) newSelection.push(id);
        });
        return newSelection;
      });
    }
  };

  const handleBulkUnsubscribe = () => {
    if (selectedSubscribers.length === 0) return;
    setShowBulkUnsubscribeModal(true);
  };

  const confirmBulkUnsubscribe = async () => {
    if (selectedSubscribers.length === 0) return;

    setIsBulkProcessing(true);
    const baseUrl = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace('/graphql', '').replace(/\/$/, '');

    try {
      const selectedEmails = subscribers
        .filter(sub => selectedSubscribers.includes(sub._id))
        .map(sub => sub.email);

      const results = await Promise.allSettled(
        selectedEmails.map(email =>
          fetch(`${baseUrl}/api/newsletter/unsubscribe`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email }),
            signal: AbortSignal.timeout(10000)
          }).then(res => res.json())
        )
      );

      const successCount = results.filter(r => r.status === 'fulfilled' && (r.value as any).success).length;
      const failCount = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !(r.value as any).success)).length;

      if (successCount > 0) {
        addToast({
          type: successCount === selectedSubscribers.length ? 'success' : 'warning',
          title: successCount === selectedSubscribers.length ? 'Success!' : 'Partial Success',
          message: `${successCount} subscriber(s) unsubscribed successfully${failCount > 0 ? ` (${failCount} failed)` : ''}`,
          duration: 5000
        });
      }

      if (failCount > 0 && successCount === 0) {
        addToast({
          type: 'error',
          title: 'Unsubscribe Failed',
          message: `Failed to unsubscribe ${failCount} subscriber(s)`,
          duration: 5000
        });
      }

      fetchSubscribers();
      setShowBulkUnsubscribeModal(false);
      setSelectedSubscribers([]);
    } catch (err) {
      console.error('❌ Bulk unsubscribe error:', err);
      addToast({
        type: 'error',
        title: 'Unsubscribe Failed',
        message: 'Failed to unsubscribe: ' + (err instanceof Error ? err.message : 'Network error'),
        duration: 5000
      });
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleExportToCSV = () => {
    if (selectedSubscribers.length === 0) return;

    const selectedSubData = subscribers.filter(sub => selectedSubscribers.includes(sub._id));
    
    const csvData = selectedSubData.map(sub => ({
      Email: sub.email,
      Status: sub.isActive ? 'Active' : 'Inactive',
      Source: sub.source,
      'Subscribed At': formatDate(sub.subscribedAt),
      'Emails Sent': sub.emailCount,
      'Last Email': sub.lastEmailSent ? formatDate(sub.lastEmailSent) : 'N/A'
    }));

    const headers = Object.keys(csvData[0]).join(',');
    const rows = csvData.map(row => Object.values(row).join(',')).join('\n');
    const csv = `${headers}\n${rows}`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `newsletter_subscribers_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    addToast({
      type: 'success',
      title: 'Export Successful',
      message: `${selectedSubscribers.length} subscriber(s) exported to CSV`,
      duration: 3000
    });
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
      <div className={`min-h-screen bg-gray-100 ${isMobile ? 'ml-0 pt-16' : 'ml-0 md:ml-16 lg:ml-60'} md:pr-5 p-4 md:p-6`}>
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
      className={`min-h-screen bg-gray-100 ${isMobile ? 'ml-0 pt-16' : 'ml-0 md:ml-16 lg:ml-60'} md:pr-5 p-4 md:p-6 flex flex-col transition-all duration-300`}
    >
      <div className="max-w-7xl mx-auto w-full">
        {/* Mobile Header */}
        {isMobile && (
          <div className="flex items-center mb-4">
            <h1 className="text-2xl font-bold text-gray-800">
              Newsletter Management
            </h1>
          </div>
        )}

        {/* Header with Title and Filters */}
        <div className={`flex ${isMobile ? 'flex-col gap-4' : 'flex-row items-center justify-between pt-4'} mb-6`}>
          {!isMobile && (
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-800 flex-shrink-0">
              Newsletter Management
            </h1>
          )}
          <div className={`flex ${isMobile ? 'flex-col gap-2 w-full' : 'flex-row gap-2'}`}>
              <input
                type="text"
                className={`text-xs text-black rounded-md pl-5 py-3 ${isMobile ? 'w-full' : 'w-80'} shadow-md focus:outline-none bg-white`}
                placeholder="Search Subscribers"
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
            {isMobile ? (
              <div className="flex flex-row gap-2 w-full">
                <div className="relative flex-1" ref={filterDropdownRef}>
                  <button
                    onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                    className={`flex items-center justify-between w-full text-xs text-black rounded-md pl-6 pr-4 py-3 shadow-md focus:outline-none bg-white gap-2`}
                  >
                    <span className="truncate">{selectedFilter}</span>
                    <ChevronDown size={16} className={`flex-shrink-0 transform transition-transform duration-200 ${showFilterDropdown ? 'rotate-180' : 'rotate-0'}`} />
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
                <div className="relative flex-1" ref={sortDropdownRef}>
                  <button
                    onClick={() => setShowSortDropdown(!showSortDropdown)}
                    className={`flex items-center justify-between w-full text-xs text-black rounded-lg pl-6 pr-4 py-3 shadow-md focus:outline-none bg-white gap-2`}
                  >
                    <span className="truncate">{sortBy}</span>
                    <ChevronDown size={16} className={`flex-shrink-0 transform transition-transform duration-200 ${showSortDropdown ? 'rotate-180' : 'rotate-0'}`} />
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
            ) : (
              <>
                <div className={`relative w-44`} ref={filterDropdownRef}>
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
                <div className={`relative w-48`} ref={sortDropdownRef}>
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
              </>
            )}
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
              onClick={() => handleOpenEmailModal(true)}
              className={`flex items-center justify-center gap-2 bg-green-600 text-xs text-white px-3 py-3 rounded-md hover:bg-green-700 transition-colors duration-200 ${
                isMobile ? 'text-xs flex-[0.8]' : ''
              }`}
              disabled={stats.active === 0}
            >
              <Mail className="w-4 h-4" />
              Email All Active Subscribers
            </button>

            {/* Email Selected Subscribers Button (only show if some are selected) */}
            {selectedSubscribers.length > 0 && (
              <button
                onClick={() => handleOpenEmailModal(false)}
                className={`flex items-center justify-center gap-2 bg-blue-600 text-xs text-white px-3 py-3 rounded-md hover:bg-blue-700 transition-colors duration-200 ${
                  isMobile ? 'text-xs flex-1' : ''
                }`}
              >
                <Send className="w-4 h-4" />
                Email Selected ({selectedSubscribers.length})
              </button>
            )}
          </div>

          <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-5'} gap-4 mb-8`}>
              {/* Total Subscribers */}
              <div className="bg-blue-50 shadow-md rounded-lg p-6">
                <div className={`flex items-center ${isMobile ? 'justify-between' : ''}`}>
                  <div className="text-3xl font-bold text-blue-600">{stats.total}</div>
                  <div className={`${isMobile ? 'ml-0' : 'ml-4'}`}>
                    <div className="text-sm text-right text-gray-600">Total</div>
                    <div className="text-xs text-gray-500">All time</div>
                  </div>
                </div>
              </div>

              {/* Active Subscribers */}
              <div className="bg-green-50 shadow-md rounded-lg p-6">
                <div className={`flex items-center ${isMobile ? 'justify-between' : ''}`}>
                  <div className="text-3xl font-bold text-green-600">{stats.active}</div>
                  <div className={`${isMobile ? 'ml-0' : 'ml-4'}`}>
                    <div className="text-sm text-right text-gray-600">Active</div>
                    <div className="text-xs text-gray-500">Currently subscribed</div>
                  </div>
                </div>
              </div>

              {/* Registration Source */}
              <div className="bg-purple-50 shadow-md rounded-lg p-6">
                <div className={`flex items-center ${isMobile ? 'justify-between' : ''}`}>
                  <div className="text-3xl font-bold text-purple-600">{stats.userSubscribers}</div>
                  <div className={`${isMobile ? 'ml-0' : 'ml-4'}`}>
                    <div className="text-sm text-right text-gray-600">Registration</div>
                    <div className="text-xs text-gray-500">Registered users</div>
                  </div>
                </div>
              </div>

              {/* Contact Form Source */}
              <div className="bg-orange-50 shadow-md rounded-lg p-6">
                <div className={`flex items-center ${isMobile ? 'justify-between' : ''}`}>
                  <div className="text-3xl font-bold text-orange-600">{stats.nonUserSubscribers}</div>
                  <div className={`${isMobile ? 'ml-0' : 'ml-4'}`}>
                    <div className="text-sm text-right text-gray-600">Contact Form</div>
                    <div className="text-xs text-gray-500">Contact submissions</div>
                  </div>
                </div>
              </div>

              {/* Inactive Subscribers */}
              <div className="bg-red-50 shadow-md rounded-lg p-6">
                <div className={`flex items-center ${isMobile ? 'justify-between' : ''}`}>
                  <div className="text-3xl font-bold text-red-600">{stats.inactive}</div>
                  <div className={`${isMobile ? 'ml-0' : 'ml-4'}`}>
                    <div className="text-sm text-right text-gray-600">Inactive</div>
                    <div className="text-xs text-gray-500">No longer active</div>
                  </div>
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

          {/* Bulk Actions Bar */}
          {selectedSubscribers.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <span className="text-sm font-medium text-blue-800">
                    {selectedSubscribers.length} subscriber{selectedSubscribers.length > 1 ? 's' : ''} selected
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {subscribers.filter(sub => selectedSubscribers.includes(sub._id) && sub.isActive).length > 0 && (
                      <button
                        onClick={handleBulkUnsubscribe}
                        className="px-3 py-1 bg-red-100 text-red-800 text-xs font-medium rounded hover:bg-red-200"
                      >
                        Unsubscribe Selected
                      </button>
                    )}
                    <button
                      onClick={handleExportToCSV}
                      className="px-3 py-1 bg-green-100 text-green-800 text-xs font-medium rounded hover:bg-green-200"
                    >
                      Export to CSV
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedSubscribers([])}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium self-start sm:self-auto"
                >
                  Clear Selection
                </button>
              </div>
            </div>
          )}

          <div className="rounded-md mb-4 overflow-hidden">
            {/* Header - Hidden on mobile */}
            {!isMobile && (
              <div className="grid grid-cols-12 gap-1 px-4 py-2 text-sm font-semibold text-gray-600 bg-gray-100">
                <div className="col-span-3 flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="form-checkbox"
                    checked={
                      paginatedSubscribers.filter(sub => sub.isActive).length > 0 && 
                      paginatedSubscribers.filter(sub => sub.isActive).every(sub => selectedSubscribers.includes(sub._id))
                    }
                    onChange={handleSelectAll}
                  />
                  <span className="cursor-pointer" onClick={handleSelectAll}>Email</span>
                </div>
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
                              subscriber.source === "registration"
                                ? "bg-purple-100 text-purple-800"
                                : "bg-orange-100 text-orange-800"
                            }`}
                          >
                            {subscriber.source === "registration"
                              ? "REGISTRATION"
                              : "CONTACT FORM"}
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
                      <div className="col-span-3 flex items-center gap-2">
                        <input
                          type="checkbox"
                          className={`form-checkbox ${!subscriber.isActive ? 'opacity-50 cursor-not-allowed' : ''}`}
                          checked={selectedSubscribers.includes(subscriber._id)}
                          onChange={() => handleSubscriberSelect(subscriber._id)}
                          onClick={(e) => e.stopPropagation()}
                          disabled={!subscriber.isActive}
                          title={!subscriber.isActive ? 'Cannot email inactive subscribers' : ''}
                        />
                        <span className={`truncate font-medium ${subscriber.isActive ? 'text-gray-900' : 'text-gray-400'}`}>
                          {subscriber.email}
                        </span>
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
                            subscriber.source === "registration"
                              ? "bg-purple-100 text-purple-800"
                              : "bg-orange-100 text-orange-800"
                            }`}
                        >
                          {subscriber.source === "registration"
                            ? "REGISTRATION"
                            : "CONTACT FORM"}
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
        </div>

        {showUnsubscribeModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
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

        {/* Bulk Unsubscribe Modal */}
        {showBulkUnsubscribeModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
            <div className="bg-white rounded-lg p-6 max-w-md w-full m-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-800">Unsubscribe Multiple Subscribers</h2>
                <button
                  onClick={() => setShowBulkUnsubscribeModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={20} />
                </button>
              </div>

              <p className="text-gray-600 mb-6">
                Are you sure you want to unsubscribe <strong>{selectedSubscribers.length}</strong> subscriber(s) from the newsletter? This action cannot be undone.
              </p>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowBulkUnsubscribeModal(false)}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                  disabled={isBulkProcessing}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmBulkUnsubscribe}
                  disabled={isBulkProcessing}
                  className={`px-4 py-2 text-white rounded ${
                    isBulkProcessing
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {isBulkProcessing ? 'Processing...' : `Unsubscribe ${selectedSubscribers.length} Subscriber${selectedSubscribers.length > 1 ? 's' : ''}`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Email Compose Modal */}
        {isEmailModalOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4"
            onClick={() => setIsEmailModalOpen(false)}
          >
            <div
              className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Send Newsletter Email</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {sendToAllActive
                      ? `Send to all ${stats.active} active subscribers`
                      : `Send to ${selectedSubscribers.length} selected subscriber(s)`}
                  </p>
                </div>
                <button
                  onClick={() => setIsEmailModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-4">
                {/* Send To Options */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Send To:
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="sendTo"
                        checked={sendToAllActive}
                        onChange={() => setSendToAllActive(true)}
                        className="form-radio text-blue-600"
                      />
                      <span className="text-sm text-gray-700">
                        All Active Subscribers ({stats.active} subscribers)
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="sendTo"
                        checked={!sendToAllActive}
                        onChange={() => setSendToAllActive(false)}
                        className="form-radio text-blue-600"
                        disabled={selectedSubscribers.length === 0}
                      />
                      <span className={`text-sm ${selectedSubscribers.length === 0 ? 'text-gray-400' : 'text-gray-700'}`}>
                        Selected Subscribers Only ({selectedSubscribers.length} selected)
                      </span>
                    </label>
                  </div>
                </div>

                {/* Subject */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Subject <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    placeholder="Enter email subject"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Message */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Message <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={emailMessage}
                    onChange={(e) => setEmailMessage(e.target.value)}
                    placeholder="Enter your message..."
                    rows={8}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>

                {/* Image Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Image (Optional)
                  </label>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg cursor-pointer transition-colors">
                      <Upload size={16} />
                      <span className="text-sm">Choose Image</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageSelect}
                        className="hidden"
                      />
                    </label>
                    {emailImage && (
                      <button
                        onClick={() => {
                          setEmailImage(null);
                          setEmailImagePreview(null);
                        }}
                        className="text-red-600 hover:text-red-700 text-sm"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  {emailImagePreview && (
                    <div className="mt-3 border border-gray-200 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-2">Preview:</p>
                      <img
                        src={emailImagePreview}
                        alt="Preview"
                        className="max-w-full h-auto max-h-64 rounded"
                      />
                    </div>
                  )}
                </div>

                {/* Note */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs text-blue-800">
                    <strong>Note:</strong> Email will be sent via BCC to protect subscriber privacy. 
                    The image will be displayed at the top of the email message.
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
                <button
                  onClick={() => setIsEmailModalOpen(false)}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                  disabled={isSendingEmail}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendNewsletter}
                  disabled={isSendingEmail || !emailSubject.trim() || !emailMessage.trim()}
                  className={`px-6 py-2 rounded-lg transition-colors font-medium flex items-center gap-2 ${
                    isSendingEmail || !emailSubject.trim() || !emailMessage.trim()
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  {isSendingEmail ? (
                    <>
                      <Loader size={16} className="animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send size={16} />
                      Send Email
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toast Notifications */}
<ToastContainer toasts={toasts} onRemove={removeToast} />
</div>
);
};

export default NewsletterManagement;