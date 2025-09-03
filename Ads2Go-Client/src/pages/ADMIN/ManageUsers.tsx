import React, { useState, useEffect } from 'react';
import { Mail, Phone, MapPin, X, Eye } from 'lucide-react';
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

// Removed unused GET_USER_ADS_COUNT query

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
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
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
          if (selectedUser?.id === id) setSelectedUser(null);

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

  // View details in modal
  const handleViewDetails = (user: User) => {
    setSelectedUser(user);
    setShowDetailsModal(true);
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
              className="bg-white border-t border-gray-300"
            >
              <div
                className="grid grid-cols-12 gap-4 items-center px-4 py-3 text-sm hover:bg-gray-100 transition-colors"
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
                  <button
                    className="bg-blue-500 text-white text-xs px-2 py-1 rounded hover:bg-blue-600"
                    onClick={() => handleViewDetails(user)}
                    title="View Details"
                  >
                    <Eye size={12} />
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
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-6xl w-full max-h-[90vh] overflow-y-auto m-4 relative">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white bg-[#FF9D3D] shadow-md">
                    {getInitials(selectedUser.firstName, selectedUser.lastName)}
                  </div>
                  <h2 className="text-2xl font-bold">User Details</h2>
                </div>
                <button onClick={() => setShowDetailsModal(false)} className="text-gray-500 hover:text-gray-700">
                  <X size={24} />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <h3 className="text-lg font-semibold mb-3">Personal & Account</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center"><span className="font-semibold">ID:</span><span>{selectedUser.id}</span></div>
                    <div className="flex justify-between items-center"><span className="font-semibold">City:</span><span>{selectedUser.city}</span></div>
                    <div className="flex justify-between items-center"><span className="font-semibold">Company:</span><span>{selectedUser.company}</span></div>
                    <div className="flex justify-between items-center"><span className="font-semibold">Status:</span>
                      <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${selectedUser.status === 'active' ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
                        {selectedUser.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center"><span className="font-semibold">Email Verified:</span><span>{selectedUser.isEmailVerified ? 'Yes' : 'No'}</span></div>
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-3">System</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center"><span className="font-semibold">Ads Count:</span><span>{selectedUser.adsCount}</span></div>
                    <div className="flex justify-between items-center"><span className="font-semibold">Riders Count:</span><span>{selectedUser.ridersCount}</span></div>
                    <div className="flex justify-between items-center"><span className="font-semibold">Last Login:</span><span>{formatDate(selectedUser.lastLogin)}</span></div>
                    <div className="flex justify-between items-center"><span className="font-semibold">Created At:</span><span>{formatDate(selectedUser.createdAt)}</span></div>
                    <div className="flex justify-between items-center"><span className="font-semibold">Updated At:</span><span>{formatDate(selectedUser.updatedAt)}</span></div>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 text-sm">
                <div className="flex items-center gap-2 text-gray-600"><Mail size={16} /><span>{selectedUser.email}</span></div>
                <div className="flex items-center gap-2 text-gray-600"><Phone size={16} /><span>{selectedUser.contact}</span></div>
                <div className="flex items-center gap-2 text-gray-600"><MapPin size={16} /><p>{selectedUser.address}, {selectedUser.city}</p></div>
                {selectedUser.houseAddress && (
                  <div className="flex items-center gap-2 text-gray-600"><MapPin size={16} /><p>House: {selectedUser.houseAddress}</p></div>
                )}
              </div>
              <div className="flex gap-3 justify-end mt-6">
                <button className="px-4 py-2 text-red-600 border border-red-600 rounded hover:bg-red-50" onClick={() => { setShowDetailsModal(false); handleDelete(selectedUser.id); }}>Delete User</button>
                <button className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50" onClick={() => setShowDetailsModal(false)}>Close</button>
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
      </div>
    </AdminLayout>
  );
};

export default ManageUsers;