import React, { useState, useEffect } from 'react';
import { Mail, ChevronDown, Phone, MapPin, X, Eye, Trash, ChevronLeft, ChevronRight, Menu } from 'lucide-react';
import { useQuery, useMutation } from '@apollo/client';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { GET_ALL_USERS } from '../../graphql/admin/queries/manageUsers';
import { DELETE_USER } from '../../graphql/admin/mutations/manageUsers';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmationModal from '../../components/ConfirmationModal';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { AdminLoader } from "../../components/ProtectedRoute";

interface User {
  id: string;
  lastName: string;
  firstName: string;
  middleName: string;
  company: string;
  address: string;
  contact: string;
  email: string;
  status: 'active' | 'inactive';
  city: string;
  ads: { id: string }[];
  isEmailVerified: boolean;
  lastLogin: Date | null;
  createdAt: Date;
  updatedAt: Date;
  role: string;
  profilePicture: string | null;
  houseAddress: string | null;
}

const cities = ['Manila', 'Quezon City', 'Cebu', 'Davao', 'Iloilo', 'Baguio', 'Makati', 'Mandaluyong', 'Taguig', 'Pasig', 'Parañaque'];

// Helper function to safely parse dates
const parseDate = (dateString: any): Date | null => {
  if (!dateString) return null;
  
  try {
    let date: Date;
    
    if (typeof dateString === 'number') {
      date = new Date(dateString);
    }
    else if (typeof dateString === 'string') {
      if (dateString.includes('T') || dateString.includes('Z')) {
        date = new Date(dateString);
      }
      else if (/^\d+$/.test(dateString)) {
        const timestamp = parseInt(dateString);
        date = new Date(timestamp < 10000000000 ? timestamp * 1000 : timestamp);
      }
      else {
        date = new Date(dateString);
      }
    }
    else if (dateString instanceof Date) {
      date = dateString;
    }
    else {
      date = new Date(dateString);
    }
    
    if (isNaN(date.getTime())) {
      console.warn('Invalid date received:', dateString);
      return null;
    }
    
    return date;
  } catch (error) {
    console.warn('Error parsing date:', dateString, error);
    return null;
  }
};

// Helper function to format date for display
const formatDate = (date: Date | null): string => {
  if (!date) return 'Never';
  
  try {
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch (error) {
    console.warn('Error formatting date:', date, error);
    return 'Invalid Date';
  }
};

// Helper function to format date for last access (shorter format)
const formatLastAccess = (date: Date | null): string => {
  if (!date) return 'Never';
  
  try {
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return 'Today';
    }
    else if (diffInHours < 168) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    }
    else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });
    }
  } catch (error) {
    console.warn('Error formatting last access date:', date, error);
    return 'Invalid Date';
  }
};

const ManageUsers: React.FC = () => {
  const { admin, isLoading: authLoading, isInitialized } = useAdminAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const statusFilterOptions = ['All Status', 'Active', 'Inactive'];
  const cityFilterOptions = ['All Cities', ...cities];

  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('All Status');

  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const [selectedCityFilter, setSelectedCityFilter] = useState('All Cities');

  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  
  // Responsive state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      setIsMobile(width < 768);
      setSidebarCollapsed(width >= 768 && width < 1024);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(9);

  // Dynamic margin based on sidebar state and screen size
  const contentMargin = isMobile ? "ml-0 pt-16" : sidebarCollapsed ? "ml-16" : "ml-60";
 
  // Fetch users using useQuery hook
  const { data: usersData, loading: usersLoading, error: usersError } = useQuery(GET_ALL_USERS, {
    fetchPolicy: 'network-only',
  });

  // Delete user mutation
  const [deleteUser] = useMutation(DELETE_USER);

  // Check screen size and setup responsive behavior
  useEffect(() => {
    const checkScreenSize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      
      // On mobile, we want less padding and collapsed sidebar by default
      if (mobile) {
        setSidebarCollapsed(true);
      }
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Transform users data when it changes
  useEffect(() => {
    if (usersData?.getAllUsers) {
      const userData = usersData.getAllUsers;
      
      const transformedUsers: User[] = userData.map((user: any) => {
        const addressParts = user.companyAddress?.split(',') || [];
        const city = addressParts.length > 1 ? addressParts[addressParts.length - 1].trim() : 'Unknown';
        
        const lastLogin = parseDate(user.lastLogin);
        const createdAt = parseDate(user.createdAt) || new Date();
        const updatedAt = parseDate(user.updatedAt) || new Date();
        
        return {
          id: user.id,
          lastName: user.lastName || '',
          firstName: user.firstName || '',
          middleName: user.middleName || '',
          company: user.companyName || '',
          address: user.companyAddress || '',
          contact: user.contactNumber || '',
          email: user.email || '',
          status: user.isEmailVerified ? 'active' : 'inactive',
          city: city,
          ads: user.ads || [],
          isEmailVerified: user.isEmailVerified || false,
          lastLogin,
          createdAt,
          updatedAt,
          role: user.role || 'USER',
          profilePicture: user.profilePicture || null,
          houseAddress: user.houseAddress || null
        };
      });
      
      setUsers(transformedUsers);
      setError(null);
      setLoading(false);
    }
  }, [usersData]);

  // Handle loading and error states
  useEffect(() => {
    setLoading(usersLoading);
  }, [usersLoading]);

  useEffect(() => {
    if (usersError) {
      const errorMessage = usersError.message || 'Unknown error';
      setError('Failed to fetch advertisers: ' + errorMessage);
      console.error('Error fetching advertisers:', usersError);
      setLoading(false);
    }
  }, [usersError]);

  // Helper function to get initials for the user avatar
  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
  };

  const handleDelete = (id: string) => {
    setUserToDelete(id);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (userToDelete) {
      try {
        const result = await deleteUser({
          variables: { id: userToDelete },
        });
        
        if (result.data?.deleteUser?.success) {
          setUsers(prev => prev.filter((user) => user.id !== userToDelete));
          if (selectedUser?.id === userToDelete) setSelectedUser(null);
          setSelectedUsers(prev => prev.filter(userId => userId !== userToDelete));
          alert('Advertiser deleted successfully');
        } else {
          alert('Failed to delete advertiser: ' + (result.data?.deleteUser?.message || 'Unknown error'));
        }
        setShowDeleteModal(false);
        setUserToDelete(null);
      } catch (err: any) {
        alert('Error deleting advertiser: ' + (err.message || 'Unknown error'));
        console.error('Error deleting advertiser:', err);
        setShowDeleteModal(false);
        setUserToDelete(null);
      }
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setUserToDelete(null);
  };

  const handleStatusFilterChange = (status: string) => {
    setSelectedStatusFilter(status);
    setShowStatusDropdown(false);
  };

  const handleCityFilterChange = (city: string) => {
    setSelectedCityFilter(city);
    setShowCityDropdown(false);
  };

  // Filter users based on search term, status, and city
  const filteredUsers = users.filter((user) => {
    const searchLower = searchTerm.toLowerCase();
    const fullName = `${user.firstName} ${user.middleName} ${user.lastName}`.toLowerCase();
    const matchesSearch = 
      fullName.includes(searchLower) ||
      user.email.toLowerCase().includes(searchLower) ||
      user.company.toLowerCase().includes(searchLower) ||
      user.contact.toLowerCase().includes(searchLower);
    
    const matchesStatus = selectedStatusFilter === 'All Status' || user.status.toLowerCase() === selectedStatusFilter.toLowerCase();
    const matchesCity = selectedCityFilter === 'All Cities' || user.city.toLowerCase().includes(selectedCityFilter.toLowerCase());
    
    return matchesSearch && matchesStatus && matchesCity;
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedStatusFilter, selectedCityFilter]);

  // View details in modal
  const handleViewDetails = (user: User) => {
    setSelectedUser(user);
    setShowDetailsModal(true);
    setTimeout(() => {
      setIsModalOpen(true);
    }, 10);
  };
  
  // Close modal with animation
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setTimeout(() => {
      setShowDetailsModal(false);
      setSelectedUser(null);
    }, 300);
  };

  // Handle individual user selection
  const handleUserSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedUsers(prevSelected =>
      prevSelected.includes(id)
        ? prevSelected.filter(userId => userId !== id)
        : [...prevSelected, id]
    );
  };

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

  // Handle select all users (only for current page)
  const handleSelectAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    const currentPageUserIds = paginatedUsers.map(user => user.id);
    const allCurrentPageSelected = currentPageUserIds.every(id => selectedUsers.includes(id));
    
    if (allCurrentPageSelected) {
      setSelectedUsers(prev => prev.filter(id => !currentPageUserIds.includes(id)));
    } else {
      setSelectedUsers(prev => {
        const newSelection = [...prev];
        currentPageUserIds.forEach(id => {
          if (!newSelection.includes(id)) {
            newSelection.push(id);
          }
        });
        return newSelection;
      });
    }
  };

  const isAllSelected = paginatedUsers.length > 0 && paginatedUsers.every(user => selectedUsers.includes(user.id));

  // Show loading state while authentication is being checked
  if (authLoading || !isInitialized) {
    return <AdminLoader />;
  }

  // Check if admin is authenticated
  if (!admin) {
    return (
      <div className={`min-h-screen bg-gray-100 p-6 ${contentMargin} flex justify-center items-center transition-all duration-300`}>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Access Denied</h2>
          <p className="text-gray-600">You must be logged in to access this page.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`min-h-screen bg-gray-100 p-6 ${contentMargin} flex justify-center items-center transition-all duration-300`}>
        <div className="text-center">
          <div className="text-red-500 text-lg mb-4">{error}</div>
          <div className="text-sm text-gray-600 mb-4">
            Please check:
            <ul className="list-disc list-inside mt-1">
              <li>GraphQL server is running on port 5000</li>
              <li>You have admin privileges</li>
              <li>Authentication token is valid</li>
            </ul>
          </div>
          <button 
            className="px-4 py-2 bg-blue-500 text-white rounded"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
      <div
      className={`min-h-screen bg-gray-100 p-6 ${contentMargin} flex flex-col transition-all duration-300`}
    >
    
        {/* Mobile Header */}
        {isMobile && (
          <div className="flex items-center mb-4">
            <h1 className="text-xl pt-7 font-bold text-gray-800">Advertisers Management</h1>
          </div>
        )}

        {/* Header with Title and Filters */}
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 mb-6">
          {!isMobile && (
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-800">Advertisers Management</h1>
          )}
        
        <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
          {/* Search Input */}
          <div className="w-full lg:w-80">
            <input
              type="text"
              className="w-full text-xs text-black rounded-lg pl-4 py-3 shadow-md focus:outline-none bg-white"
              placeholder="Search advertisers by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex gap-2">
            {/* STATUS Filter */}
            <div className="relative flex-1 sm:flex-none sm:w-32">
              <button
                onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                className="flex items-center justify-between w-full text-xs text-black rounded-lg pl-4 pr-3 py-3 shadow-md focus:outline-none bg-white gap-2"
              >
                <span className="truncate">{selectedStatusFilter}</span>
                <ChevronDown
                  size={16}
                  className={`flex-shrink-0 transform transition-transform duration-200 ${showStatusDropdown ? 'rotate-180' : ''}`}
                />
              </button>

              <AnimatePresence>
                {showStatusDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="absolute z-10 top-full mt-2 w-full rounded-lg shadow-lg bg-white overflow-hidden"
                  >
                    {statusFilterOptions.map((status) => (
                      <button
                        key={status}
                        onClick={() => handleStatusFilterChange(status)}
                        className="block w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-100 transition-colors duration-150"
                      >
                        {status}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* CITY Filter */}
            <div className="relative flex-1 sm:flex-none sm:w-32">
              <button
                onClick={() => setShowCityDropdown(!showCityDropdown)}
                className="flex items-center justify-between w-full text-xs text-black rounded-lg pl-4 pr-3 py-3 shadow-md focus:outline-none bg-white gap-2"
              >
                <span className="truncate">{selectedCityFilter}</span>
                <ChevronDown
                  size={16}
                  className={`flex-shrink-0 transform transition-transform duration-200 ${showCityDropdown ? 'rotate-180' : ''}`}
                />
              </button>

              <AnimatePresence>
                {showCityDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="absolute z-10 top-full mt-2 w-full rounded-lg shadow-lg bg-white overflow-hidden max-h-60 overflow-y-auto"
                  >
                    {cityFilterOptions.map((city) => (
                      <button
                        key={city}
                        onClick={() => handleCityFilterChange(city)}
                        className="block w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-100 transition-colors duration-150"
                      >
                        {city}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* User List */}
      {loading ? (
        <AdminLoader />
      ) : error ? (
        <div className="text-center py-10 text-red-500">Error: {error}</div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-10 text-gray-500">
          {searchTerm ? 'No advertisers match your search criteria' : 'No advertisers found'}
        </div>
      ) : (
        <div className="flex-1 flex flex-col">
          <div className="rounded-xl mb-4 overflow-hidden flex-1">
            {/* Table Header - Hidden on mobile */}
            {!isMobile && (
              <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2 text-sm font-semibold text-black">
                <div className="flex items-center gap-2 col-span-3">
                  <input
                    type="checkbox"
                    className="form-checkbox"
                    onChange={() => {}}
                    onClick={handleSelectAll}
                    checked={isAllSelected}
                  />
                  <span className="cursor-pointer" onClick={handleSelectAll}>Name</span>
                </div>
                <div className="col-span-3">Email</div>
                <div className="col-span-2">Company</div>
                <div className="col-span-1 flex items-center gap-1">
                  <span>Status</span>
                </div>
                <div className="col-span-2 pl-16">Last Access</div>
                <div className="col-span-1 text-center">Action</div>
              </div>
            )}

            {/* User Cards */}
            {paginatedUsers.map((user) => (
              <div
                key={user.id}
                className="bg-white mb-3 rounded-lg shadow-md hover:bg-gray-50 transition-colors"
                onClick={() => handleViewDetails(user)}
              >
                {isMobile ? (
                  // Mobile Card Layout
                  <div className="p-4 cursor-pointer">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          className="form-checkbox"
                          checked={selectedUsers.includes(user.id)}
                          onChange={() => {}}
                          onClick={(e) => handleUserSelect(user.id, e)}
                        />
                        <div className="flex items-center justify-center w-10 h-10 text-sm font-semibold text-white rounded-full bg-[#FF9D3D]">
                          {getInitials(user.firstName, user.lastName)}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-800">
                            {user.firstName} {user.lastName}
                          </div>
                          <div className="text-xs text-gray-500 truncate max-w-[150px]">
                            {user.email}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-sm text-black mb-3">
                      <div>
                        <div className="font-medium">Company</div>
                        <div className="truncate">{user.company}</div>
                      </div>
                      <div>
                        <div className="font-medium">Last Access</div>
                        <div>{formatLastAccess(user.lastLogin)}</div>
                      </div>
                    </div>
                    
                    <div className="flex justify-end gap-2">
                    <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          user.status === 'active'
                            ? 'bg-green-200 text-green-800'
                            : 'bg-red-200 text-red-800'
                        }`}
                      >
                        {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                      </span>
                      <button
                        className="flex items-center text-red-700 px-1 py-1 rounded shadow-md hover:bg-red-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(user.id);
                        }}
                      >
                        <Trash size={14} />
                      </button>
                    </div>
                  </div>
                ) : (
                  // Desktop Card Layout
                  <div className="grid grid-cols-12 gap-4 items-center px-4 py-3 text-sm transition-colors cursor-pointer rounded-lg">
                    <div className="col-span-3 gap-3 flex items-center">
                      <input
                        type="checkbox"
                        className="form-checkbox"
                        checked={selectedUsers.includes(user.id)}
                        onChange={() => {}}
                        onClick={(e) => handleUserSelect(user.id, e)}
                      />
                      <div className="flex items-center">
                        <div className="flex items-center justify-center w-8 h-8 mr-3 text-xs font-semibold text-white rounded-full bg-[#FF9D3D]">
                          {getInitials(user.firstName, user.lastName)}
                        </div>
                        <span className="truncate font-semibold">
                          {user.firstName} {user.middleName} {user.lastName}
                        </span>
                      </div>
                    </div>

                    <div className="col-span-3 truncate">{user.email}</div>
                    <div className="col-span-2 truncate">{user.company}</div>

                    <div className="col-span-1">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          user.status === 'active'
                            ? 'bg-green-200 text-green-800'
                            : 'bg-red-200 text-red-800'
                        }`}
                      >
                        {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                      </span>
                    </div>

                    <div className="col-span-2 truncate text-center">
                      {formatLastAccess(user.lastLogin)}
                    </div>

                    <div
                      className="col-span-1 flex items-center justify-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        className="group flex items-center text-red-700 overflow-hidden h-8 w-7 hover:w-20 transition-[width] duration-300"
                        onClick={() => handleDelete(user.id)}
                        title="Delete"
                      >
                        <Trash 
                          className="flex-shrink-0 mx-auto mr-1 group-hover:ml-1.5 transition-all duration-300"
                          size={16} />
                        <span className="opacity-0 group-hover:opacity-100 text-xs group-hover:mr-4 whitespace-nowrap transition-all duration-300">
                          Delete
                        </span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Details Modal - Responsive */}
      {showDetailsModal && selectedUser && (
        <div
          className="fixed inset-0 z-50 overflow-hidden bg-black bg-opacity-50"
          onClick={handleCloseModal}
        >
          <div
            className={`fixed ${
              isMobile
                ? 'inset-x-4 top-16 bottom-6 w-auto max-h-[80vh] rounded-md' // mobile/tablet layout
                : 'top-2 bottom-2 right-2 w-full max-w-xl rounded-lg'        // desktop layout
            } bg-white shadow-xl transform transition-all duration-300 ease-in-out ${
              isModalOpen
                ? isMobile
                  ? 'scale-100 opacity-100'
                  : 'translate-x-0 opacity-100'
                : isMobile
                  ? 'scale-95 opacity-0'
                  : 'translate-x-full opacity-0'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={`h-full ${
                isMobile ? 'p-4' : 'p-6'
              } overflow-y-auto`}
            >
              {/* Close Button for Mobile */}
              {isMobile && (
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold text-gray-800">User Details</h2>
                  <button
                    onClick={handleCloseModal}
                    className="p-1 rounded-full hover:bg-gray-200"
                  >
                    <X size={20} />
                  </button>
                </div>
              )}

              {/* User Info Section */}
              <div className="flex items-center mb-6">
                <div className={`${isMobile ? 'w-12 h-12 text-xl' : 'w-16 h-16 text-2xl'} rounded-full flex items-center justify-center font-bold text-white bg-[#FF9D3D] mr-4 shadow-md`}>
                  {getInitials(selectedUser.firstName, selectedUser.lastName)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold text-gray-800 truncate`}>
                      {selectedUser.firstName} {selectedUser.lastName}
                    </h2>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${selectedUser.status === 'active' ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
                      {selectedUser.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                    {!isMobile && (
                      <span className="text-xs bg-gray-200 rounded-full px-2 py-1 text-gray-500">
                        Last Access: {formatLastAccess(selectedUser.lastLogin)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 truncate">{selectedUser.company}</p>
                  {isMobile && (
                    <p className="text-xs text-gray-400 mt-1">
                      Last Access: {formatLastAccess(selectedUser.lastLogin)}
                    </p>
                  )}
                </div>
              </div>

              {/* Counts Section */}
              <div className="mb-6">
                <Link to={`/admin/ads-by-user/${selectedUser.id}`}>
                  <div className="bg-gray-100 p-4 rounded-lg text-center transition-colors hover:bg-gray-200 cursor-pointer">
                    <p className="text-sm font-semibold text-gray-600">Advertisement Count:</p>
                    <p className="text-2xl md:text-3xl font-bold text-gray-800">{selectedUser.ads.length}</p>
                  </div>
                </Link>
              </div>

              {/* Account Details */}
              <div className="mb-6">
                <h3 className="text-lg font-bold mb-3">Account Details:</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="space-y-3">
                    <div className="flex justify-between sm:border-b border-gray-300 pb-2">
                      <span className="text-gray-600">ID:</span>
                      <span className="font-semibold text-gray-700 text-right truncate">{selectedUser.id}</span>
                    </div>
                    <div className="flex justify-between sm:border-b border-gray-300 pb-2">
                      <span className="text-gray-600">City:</span>
                      <span className="font-semibold text-gray-700">{selectedUser.city}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Email Verified:</span>
                      <span className="font-semibold text-gray-700">
                        {selectedUser.isEmailVerified ? "✔" : "✘"}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between sm:border-b border-gray-300 pb-2">
                      <span className="text-gray-600">Last Login:</span>
                      <span className="font-semibold text-gray-700 text-right">
                        {isMobile
                          ? formatLastAccess(selectedUser.lastLogin)
                          : formatDate(selectedUser.lastLogin)}
                      </span>
                    </div>
                    <div className="flex justify-between sm:border-b border-gray-300 pb-2">
                      <span className="text-gray-600">Created At:</span>
                      <span className="font-semibold text-gray-700 text-right">
                        {isMobile
                          ? new Date(selectedUser.createdAt).toLocaleDateString()
                          : formatDate(selectedUser.createdAt)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Updated At:</span>
                      <span className="font-semibold text-gray-700 text-right">
                        {isMobile
                          ? new Date(selectedUser.updatedAt).toLocaleDateString()
                          : formatDate(selectedUser.updatedAt)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>


              {/* User Details */}
              <div className="mb-6">
                <h3 className="text-lg font-bold mb-3">User Details:</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Mail size={16} />
                    <span className="break-all font-semibold text-gray-700">{selectedUser.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <Phone size={16} />
                    <span className="font-semibold text-gray-700">{selectedUser.contact}</span>
                  </div>
                  <div className="flex items-start gap-2 text-gray-600">
                    <MapPin size={16} className="mt-0.5 flex-shrink-0" />
                    <p className="break-words font-semibold text-gray-700">{selectedUser.address}</p>
                  </div>
                  {selectedUser.houseAddress && (
                    <div className="flex items-start gap-2 text-gray-600">
                      <MapPin size={16} className="mt-0.5 flex-shrink-0" />
                      <p className="break-words font-semibold text-gray-700">House: {selectedUser.houseAddress}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pagination */}
      {filteredUsers.length > 0 && (
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
      )}
      
      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={cancelDelete}
        onConfirm={confirmDelete}
        title="Delete User"
        message="Are you sure you want to delete this user? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        confirmButtonClass="bg-red-600 hover:bg-red-700"
      />
    </div>
  );
};

export default ManageUsers;