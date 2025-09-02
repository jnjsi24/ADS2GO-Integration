import React, { useState, useEffect } from 'react';
import { ChevronDown, Mail, Phone, MapPin, Edit, X, MoreVertical } from 'lucide-react';
import { TrashIcon } from '@heroicons/react/24/outline';
import { useQuery, useMutation, gql } from '@apollo/client';
import AdminLayout from '../../components/AdminLayout';
import { useAdminAuth } from '../../contexts/AdminAuthContext';

// GraphQL queries - UPDATED to match exact schema fields
const GET_ALL_USERS = gql`
  query GetAllUsers {
    getAllUsers {
      id
      firstName
      middleName
      lastName
      email
      companyName
      companyAddress
      houseAddress
      contactNumber
      profilePicture
      role
      isEmailVerified
      lastLogin
      createdAt
      updatedAt
    }
  }
`;

const GET_USER_ADS_COUNT = gql`
  query GetUserAdsCount($userId: ID!) {
    getUserById(id: $userId) {
      id
      ads {
        id
      }
    }
  }
`;

const DELETE_USER = gql`
  mutation DeleteUser($id: ID!) {
    deleteUser(id: $id) {
      success
      message
    }
  }
`;

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
  adsCount: number;
  ridersCount: number;
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
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adsCounts, setAdsCounts] = useState<Record<string, number>>({});

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
          adsCount: 0,
          ridersCount: 0,
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

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        const result = await deleteUser({
          variables: { id },
        });
        
        if (result.data?.deleteUser?.success) {
          // Remove the user from the local state
          setUsers(prev => prev.filter((user) => user.id !== id));
          if (expandedId === id) setExpandedId(null);
          // Remove from selected users if it was selected
          setSelectedUsers(prev => prev.filter(userId => userId !== id));
          alert('User deleted successfully');
        } else {
          alert('Failed to delete user: ' + (result.data?.deleteUser?.message || 'Unknown error'));
        }
      } catch (err: any) {
        alert('Error deleting user: ' + (err.message || 'Unknown error'));
        console.error('Error deleting user:', err);
      }
    }
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
    
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
    const matchesCity = !selectedCity || user.city.toLowerCase().includes(selectedCity.toLowerCase());
    
    return matchesSearch && matchesStatus && matchesCity;
  });

  // Toggle the expanded user card
  const toggleExpand = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
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
      <div className="pr-5 p-10">
        <div className="bg-gray-100 w-full min-h-screen">
        {/* Header with Title and Add New Button */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="px-3 py-1 text-3xl font-bold text-gray-800">User List</h1>
        </div>

        {/* Search Bar and Filters */}
        <div className="flex justify-between items-center mb-4">
          <input
            type="text"
            className="text-xs text-black rounded-xl pl-5 py-3 w-60 shadow-md border border-gray-400 focus:outline-none appearance-none bg-white"
            placeholder="Search by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <div className="flex space-x-2">
            {/* Status Filter with SVG */}
            <div className="relative w-32">
              <select
                className="text-sm text-black rounded-xl pl-5 py-3 pr-8 w-full shadow-md border border-gray-400 focus:outline-none appearance-none bg-white"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {/* City Filter with SVG */}
            <div className="relative w-36">
              <select
                className="text-sm text-black rounded-xl pl-5 py-3 pr-8 w-full shadow-md border border-gray-400 focus:outline-none appearance-none bg-white"
                value={selectedCity || ''}
                onChange={(e) => setSelectedCity(e.target.value || null)}
              >
                <option value="">Filter by City</option>
                {cities.map(city => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* User List */}
        <div className="rounded-xl shadow-md mb-4 overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 bg-[#3674B5] px-4 py-2 text-sm font-semibold text-white">
            <div className="flex items-center gap-10 col-span-3">
              <input
                type="checkbox"
                className="form-checkbox"
                onChange={(e) => {}}
                onClick={handleSelectAll}
                checked={isAllSelected}
              />
              <span className="cursor-pointer" onClick={handleSelectAll}>Name</span>
            </div>
            <div className="col-span-3">Email</div>
            <div className="col-span-2">Company</div>
            <div className="col-span-1">Status</div>
            <div className="col-span-2">Last Access</div>
            <div className="col-span-1 text-center">Action</div>
          </div>

          {/* User Cards */}
          {filteredUsers.map((user) => (
            <div
              key={user.id}
              className={`bg-white border-t border-gray-300 transition-all duration-500 ease-in-out transform origin-top ${
                expandedId === user.id ? 'z-10 relative scale-105 shadow-xl' : ''
              }`}
            >
              {expandedId !== user.id ? (
                // Collapsed User Card
                <div
                  className="grid grid-cols-12 gap-4 items-center px-4 py-3 text-sm hover:bg-gray-100 transition-colors cursor-pointer"
                  onClick={() => toggleExpand(user.id)}
                >
                  <div className="col-span-3 gap-7 flex items-center">
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
                      <span className="truncate">
                        {user.firstName} {user.middleName} {user.lastName}
                      </span>
                    </div>
                  </div>
                  <div className="col-span-3 truncate">{user.email}</div>
                  <div className="col-span-2 truncate">{user.company}</div>
                  <div className="col-span-1">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${
                        user.status === 'active' ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'
                      }`}
                    >
                      {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                    </span>
                  </div>
                  <div className="col-span-2 truncate">
                    {formatLastAccess(user.lastLogin)}
                  </div>
                  <div className="col-span-1 flex items-center justify-center gap-2">
                    <button onClick={() => toggleExpand(user.id)}>
                      <ChevronDown size={16} className="inline-block text-gray-500" />
                    </button>
                  </div>
                </div>
              ) : (
                // Expanded User Card
                <div className="bg-white p-6 shadow-xl rounded-md flex flex-col lg:flex-row items-start justify-between">
                  {/* Left Section: Avatar, Name, Personal Details */}
                  <div className="flex items-start pl-6 gap-4 mb-6 lg:mb-0 lg:pr-8 border-b lg:border-b-0 lg:border-r border-gray-200 w-full lg:w-1/3">
                    <div className="relative">
                      <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white bg-[#FF9D3D] shadow-md">
                        {getInitials(user.firstName, user.lastName)}
                      </div>
                      <span className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-white ${user.status === 'active' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                    </div>
                    <div className="flex-grow">
                      <h3 className="text-xl font-bold text-gray-800 mb-1">
                        {user.firstName} {user.lastName}
                      </h3>
                      <div className="text-sm text-gray-600 space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-gray-700">ID:</span>
                          <span className="text-gray-600">{user.id}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-gray-700">City:</span>
                          <span className="text-gray-600">{user.city}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-gray-700">Company:</span>
                          <span className="text-gray-600">{user.company}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-gray-700">Status:</span>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            user.status === 'active' ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'
                          }`}>
                            {user.status === 'active' ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Middle Section: System Details */}
                  <div className="flex flex-col gap-4 mt-6 lg:mb-0 lg:px-8 border-b lg:border-b-0 lg:border-r border-gray-200 w-full lg:w-1/3">
                    <div className="text-sm">
                      <div className="space-y-2">
                        {/* Ads Count Detail */}
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-gray-700">Ads Count:</span>
                          <span className="text-gray-600">{user.adsCount}</span>
                        </div>
                        {/* Riders Count Detail */}
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-gray-700">Riders Count:</span>
                          <span className="text-gray-600">{user.ridersCount}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-gray-700">Email Verified:</span>
                          <span className="text-gray-600">
                            {user.isEmailVerified ? 'Yes' : 'No'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-gray-700">Last Login:</span>
                          <span className="text-gray-600">
                            {formatDate(user.lastLogin)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-gray-700">Created At:</span>
                          <span className="text-gray-600">
                            {formatDate(user.createdAt)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-gray-700">Updated At:</span>
                          <span className="text-gray-600">
                            {formatDate(user.updatedAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Right Section: Contacts & Address */}
                  <div className="flex flex-col gap-4 w-full lg:w-1/3 pt-6 lg:pt-0 lg:pl-8">
                    {/* Icons and Close Button - Top Right */}
                    <div className="absolute top-4 right-4 pr-6 flex items-center gap-2">
                      <button className="p-1 text-[#3674B5] rounded-full hover:bg-gray-100 transition-colors">
                        <Edit size={16} />
                      </button>
                      <button className="p-1 text-red-500 rounded-full hover:bg-gray-100 transition-colors" onClick={() => handleDelete(user.id)}>
                        <TrashIcon className="w-4 h-4" />
                      </button>
                      <button className="p-1 text-gray-500 rounded-full hover:bg-gray-100 transition-colors" onClick={() => toggleExpand(user.id)}>
                        <X size={16} />
                      </button>
                      <button className="p-1 text-gray-500 rounded-full hover:bg-gray-100 transition-colors">
                        <MoreVertical size={16} />
                      </button>
                    </div>
                    <div className="text-sm mt-6">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-gray-600">
                          <Mail size={16} />
                          <span>{user.email}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-600">
                          <Phone size={16} />
                          <span>{user.contact}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-600">
                          <MapPin size={16} />
                          <p>{user.address}, {user.city}</p>
                        </div>
                        {user.houseAddress && (
                          <div className="flex items-center gap-2 text-gray-600">
                            <MapPin size={16} />
                            <p>House: {user.houseAddress}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
          {filteredUsers.length === 0 && (
            <div className="p-4 text-center text-gray-500">
              {users.length === 0 ? 'No users found' : 'No users match your search criteria'}
            </div>
          )}
        </div>

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
      </div>
    </AdminLayout>
  );
};

export default ManageUsers;