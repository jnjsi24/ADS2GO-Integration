import React, { useState, useEffect } from 'react';
import { Mail, ChevronDown, Phone, MapPin, X, Eye, Trash } from 'lucide-react';
import { useQuery, useMutation } from '@apollo/client';
import AdminLayout from '../../components/AdminLayout';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { GET_ALL_USERS } from '../../graphql/admin/queries/manageUsers';
import { DELETE_USER } from '../../graphql/admin/mutations/manageUsers';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmationModal from '../../components/ConfirmationModal';
import { Link } from 'react-router-dom';

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
    // Handle various date formats
    let date: Date;
    
    // If it's already a number (timestamp)
    if (typeof dateString === 'number') {
      date = new Date(dateString);
    }
    // If it's a string
    else if (typeof dateString === 'string') {
      // Handle ISO string format
      if (dateString.includes('T') || dateString.includes('Z')) {
        date = new Date(dateString);
      }
      // Handle timestamp as string
      else if (/^\d+$/.test(dateString)) {
        const timestamp = parseInt(dateString);
        // If timestamp is in seconds, convert to milliseconds
        date = new Date(timestamp < 10000000000 ? timestamp * 1000 : timestamp);
      }
      // Handle other string formats
      else {
        date = new Date(dateString);
      }
    }
    // If it's already a Date object
    else if (dateString instanceof Date) {
      date = dateString;
    }
    // Default fallback
    else {
      date = new Date(dateString);
    }
    
    // Check if the date is valid
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
    
    // If within 24 hours, show "Today"
    if (diffInHours < 24) {
      return 'Today';
    }
    // If within a week, show day name
    else if (diffInHours < 168) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    }
    // Otherwise show date
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
  const [isModalOpen, setIsModalOpen] = useState(false); // New state for animation
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adsCounts, setAdsCounts] = useState<Record<string, number>>({});
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);

  // Fetch users using useQuery hook
  const { data: usersData, loading: usersLoading, error: usersError } = useQuery(GET_ALL_USERS, {
    fetchPolicy: 'network-only',
  });

  // Delete user mutation
  const [deleteUser] = useMutation(DELETE_USER);

  // Transform users data when it changes
  useEffect(() => {
    if (usersData?.getAllUsers) {
      const userData = usersData.getAllUsers;
      
      // Transform the data to match the User interface
      const transformedUsers: User[] = userData.map((user: any) => {
        // Extract city from address (last part after comma)
        const addressParts = user.companyAddress?.split(',') || [];
        const city = addressParts.length > 1 ? addressParts[addressParts.length - 1].trim() : 'Unknown';
        
        // Parse dates safely
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
      setError('Failed to fetch users: ' + errorMessage);
      console.error('Error fetching users:', usersError);
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
          // Remove the user from the local state
          setUsers(prev => prev.filter((user) => user.id !== userToDelete));
          if (selectedUser?.id === userToDelete) setSelectedUser(null);

          // Remove from selected users if it was selected
          setSelectedUsers(prev => prev.filter(userId => userId !== userToDelete));
          alert('User deleted successfully');
        } else {
          alert('Failed to delete user: ' + (result.data?.deleteUser?.message || 'Unknown error'));
        }
        setShowDeleteModal(false);
        setUserToDelete(null);
      } catch (err: any) {
        alert('Error deleting user: ' + (err.message || 'Unknown error'));
        console.error('Error deleting user:', err);
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

  // View details in modal
  const handleViewDetails = (user: User) => {
    setSelectedUser(user);
    setShowDetailsModal(true);
    // Trigger animation after the modal is rendered
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
    }, 300); // Duration matches the transition duration
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

  // Handle select all users
  const handleSelectAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedUsers.length === filteredUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(filteredUsers.map(user => user.id));
    }
  };

  const isAllSelected = selectedUsers.length === filteredUsers.length && filteredUsers.length > 0;

  // Show loading state while authentication is being checked
  if (authLoading || !isInitialized) {
    return (
      <div className="min-h-screen bg-gray-100 pl-64 pr-5 p-10 flex justify-center items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Check if admin is authenticated
  if (!admin) {
    return (
      <div className="min-h-screen bg-gray-100 pl-64 pr-5 p-10 flex justify-center items-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Access Denied</h2>
          <p className="text-gray-600">You must be logged in to access this page.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 pl-64 pr-5 p-10 flex justify-center items-center">
        <div className="text-lg">Loading users...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 pl-64 pr-5 p-10 flex justify-center items-center">
        <div className="text-red-500 text-lg">{error}</div>
        <div className="mt-2 text-sm text-gray-600">
          Please check:
          <ul className="list-disc list-inside mt-1">
            <li>GraphQL server is running on port 5000</li>
            <li>You have admin privileges</li>
            <li>Authentication token is valid</li>
          </ul>
        </div>
        <button 
          className="ml-4 px-4 py-2 bg-blue-500 text-white rounded mt-4"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gray-100 pr-5 p-10">
      {/* Header with Title and Filters */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Users Management</h1>
        <div className="flex gap-2">
          <input
            type="text"
            className="text-xs text-black rounded-lg pl-5 py-3 w-80 shadow-md focus:outline-none bg-white"
            placeholder="Search by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {/* STATUS Filter */}
          <div className="relative w-32">
            <button
              onClick={() => setShowStatusDropdown(!showStatusDropdown)}
              className="flex items-center justify-between w-full text-xs text-black rounded-lg pl-6 pr-4 py-3 shadow-md focus:outline-none bg-white gap-2">
              {selectedStatusFilter}
              <ChevronDown
                size={16}
                className={`transform transition-transform duration-200 ${showStatusDropdown ? 'rotate-180' : ''}`}
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
                      className="block w-full text-left px-4 py-2 text-xs ml-2 text-gray-700 hover:bg-gray-100 transition-colors duration-150"
                    >
                      {status}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* CITY Filter */}
          <div className="relative w-32">
            <button
              onClick={() => setShowCityDropdown(!showCityDropdown)}
              className="flex items-center justify-between w-full text-xs text-black rounded-lg pl-6 pr-4 py-3 shadow-md focus:outline-none bg-white gap-2">
              {selectedCityFilter}
              <ChevronDown
                size={16}
                className={`transform transition-transform duration-200 ${showCityDropdown ? 'rotate-180' : ''}`}
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
                      className="block w-full text-left px-4 py-2 text-xs ml-2 text-gray-700 hover:bg-gray-100 transition-colors duration-150"
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
      

        {/* User List */}
        <div className="rounded-xl mb-4 overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 px-4 py-2 text-sm font-semibold text-gray-600">
            <div className="flex items-center gap-2 ml-1 col-span-3">
              <input
                type="checkbox"
                className="form-checkbox"
                onChange={(e) => {}}
                onClick={handleSelectAll}
                checked={isAllSelected}
              />
              <span className="cursor-pointer ml-2" onClick={handleSelectAll}>Name</span>
              <svg className="w-3 h-3 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" /></svg>
            </div>
            <div className="col-span-3 ml-16">Email</div>
            <div className="col-span-2">Company</div>
            <div className="col-span-1 flex items-center gap-1 ml-7">
              <span>Status</span>
              <svg className="w-3 h-3 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" /></svg>
            </div>
            <div className="col-span-2 ml-20">Last Access</div>
            <div className="col-span-1 text-center">Action</div>
          </div>

          {/* User Cards */}
          {filteredUsers.map((user) => (
            <div
              key={user.id}
              className="bg-white mb-3 rounded-lg shadow-md"
              onClick={() => handleViewDetails(user)}
            >
              <div
                className="grid grid-cols-12 gap-4 items-center px-5 py-4 text-sm transition-colors cursor-pointer rounded-lg group hover:bg-[#3674B5]"
              >
                <div className="col-span-3 gap-4 flex items-center">
                  <input
                    type="checkbox"
                    className="form-checkbox"
                    checked={selectedUsers.includes(user.id)}
                    onChange={() => {}}
                    onClick={(e) => handleUserSelect(user.id, e)}
                  />
                  <div className="flex items-center">
                    <div className="flex items-center justify-center w-8 h-8 mr-2 text-xs font-semibold text-white rounded-full bg-[#FF9D3D]">
                      {getInitials(user.firstName, user.lastName)}
                    </div>
                    <span className="truncate font-semibold group-hover:text-white">
                      {user.firstName} {user.middleName} {user.lastName}
                    </span>
                  </div>
                </div>

                <div className="col-span-3 truncate group-hover:text-white">{user.email}</div>
                <div className="col-span-2 truncate group-hover:text-white">{user.company}</div>

                <div className="col-span-1 ml-8">
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${
                      user.status === 'active'
                        ? 'bg-green-200 text-green-800'
                        : 'bg-red-200 text-red-800'
                    } `}
                  >
                    {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                  </span>
                </div>

                <div className="col-span-2 truncate ml-10 text-center group-hover:text-white">
                  {formatLastAccess(user.lastLogin)}
                </div>

                <div
                  className="col-span-1 flex items-center justify-center gap-2"
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
            </div>
          ))}
          {filteredUsers.length === 0 && (
            <div className="p-4 text-center text-gray-500">
              {users.length === 0 ? 'No users found' : 'No users match your search criteria'}
            </div>
          )}
        </div>

        {/* Details Modal */}
        {showDetailsModal && selectedUser && (
          <div
            className="fixed inset-0 z-50 overflow-hidden"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
            onClick={handleCloseModal} // This closes the modal on outside click
          >
            <div
              className={`fixed top-2 bottom-2 right-2 max-w-2xl w-full bg-white shadow-xl rounded-lg transform transition-transform duration-300 ease-in-out ${isModalOpen ? 'translate-x-0' : 'translate-x-full'}`}
              onClick={(e) => e.stopPropagation()} // This stops the click from bubbling up and closing the modal
            >
              
              {/* Modal Content */}
              <div className="h-full p-6 overflow-y-auto">
                {/* User Info Section */}
                <div className="flex items-center mb-6">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl font-bold text-white bg-[#FF9D3D] mr-4 shadow-md">
                    {getInitials(selectedUser.firstName, selectedUser.lastName)}
                  </div>
                  <div>
                    <div className="flex items-center flex-wrap gap-2">
                      <h2 className="text-2xl font-bold text-gray-800">
                        {selectedUser.firstName} {selectedUser.lastName}
                      </h2>
                      <span className={`px-2 py-1 text-xs ml-3 font-medium rounded-full ${selectedUser.status === 'active' ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
                        {selectedUser.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                      <span className="text-xs bg-gray-200 rounded-full px-2 py-1 text-gray-500">Last Access: {formatLastAccess(selectedUser.lastLogin)}</span>
                    </div>
                    <p className="text-sm text-gray-500">{selectedUser.company}</p>
                  </div>
                </div>

                {/* Counts Section (Ads/Riders) */}
                <div className="mb-6">
                  <Link to={`/admin/ads-by-user/${selectedUser.id}`}>
                    <div className="bg-gray-100 p-4 rounded-lg text-center transition-colors hover:bg-gray-200 cursor-pointer">
                      <p className="text-sm font-semibold text-gray-600">Advertisement Count:</p>
                      <p className="text-3xl font-bold text-gray-800">{selectedUser.ads.length}</p>
                    </div>
                  </Link>
                </div>

                {/* Account Details - Now a table */}
                <div className="mb-6">
                  <h3 className="text-lg font-bold mb-3">Account Details:</h3>
                  <table className="w-full text-sm">
                    <tbody>
                      <tr>
                        {/* Left side */}
                        <td className="w-1/2 align-top pr-4">
                          <table className="w-full border-separate border-spacing-y-3">
                            <tbody>
                              <tr>
                                <td className="font-bold text-gray-700 py-1 pr-2 border-b border-gray-300">ID:</td>
                                <td className="text-gray-600 text-right py-1 border-b border-gray-300">{selectedUser.id}</td>
                              </tr>
                              <tr>
                                <td className="font-bold text-gray-700 py-1 pr-2 border-b border-gray-300">City:</td>
                                <td className="text-gray-600 text-right py-1 border-b border-gray-300">{selectedUser.city}</td>
                              </tr>
                              <tr>
                                <td className="font-bold text-gray-700 py-1 pr-2">Email Verified:</td>
                                <td className="text-black text-right py-1">
                                  {selectedUser.isEmailVerified ? "✔" : "✘"}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </td>

                        {/* Right side */}
                        <td className="w-1/2 align-top pl-4">
                          <table className="w-full border-separate border-spacing-y-3">
                            <tbody>
                              <tr>
                                <td className="font-bold text-gray-700 py-1 pr-2 border-b border-gray-300">Last Login:</td>
                                <td className="text-gray-600 py-1 border-b border-gray-300 text-right">
                                  {formatDate(selectedUser.lastLogin)}
                                </td>
                              </tr>
                              <tr>
                                <td className="font-bold text-gray-700 py-1 pr-2 border-b border-gray-300">Created At:</td>
                                <td className="text-gray-600 py-1 border-b border-gray-300 text-right">
                                  {formatDate(selectedUser.createdAt)}
                                </td>
                              </tr>
                              <tr>
                                <td className="font-bold text-gray-700 py-1 pr-2">Updated At:</td>
                                <td className="text-gray-600 py-1 text-right">
                                  {formatDate(selectedUser.updatedAt)}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* User Details */}
                <div className="mb-6">
                  <h3 className="text-lg font-bold mb-3">User Details:</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-4 text-sm">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Mail size={16} />
                      <span>{selectedUser.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Phone size={16} />
                      <span>{selectedUser.contact}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <MapPin size={16} />
                      <p>{selectedUser.address}</p>
                    </div>
                    {selectedUser.houseAddress && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <MapPin size={16} />
                        <p>House: {selectedUser.houseAddress}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer with user count */}
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-gray-600">Found: {filteredUsers.length} user(s) - Selected: {selectedUsers.length}</span>
          <div className="flex space-x-2">
            <button 
              className="px-4 py-2 text-sm text-green-600 transition-colors border border-green-600 rounded hover:bg-green-50 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={selectedUsers.length === 0}
            >
              Export {selectedUsers.length > 0 ? `${selectedUsers.length} Selected Users` : 'to Excel'}
            </button>
          </div>
        </div>
      </div>
      
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
    </AdminLayout>
  );
};

export default ManageUsers;