import React, { useState, useEffect } from 'react';
import { ChevronDown, Mail, Phone, MapPin, Edit, X, MoreVertical, Eye } from 'lucide-react';
import { TrashIcon } from '@heroicons/react/24/outline';
import { ApolloClient, InMemoryCache, gql } from '@apollo/client';

// Initialize Apollo Client
const client = new ApolloClient({
  uri: 'http://localhost:5000/graphql',
  cache: new InMemoryCache(),
  headers: {
    authorization: localStorage.getItem('token') || '',
  },
});

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

// Helper function to get initials for the user avatar
const getInitials = (firstName: string, lastName: string) => {
  return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
};

const ManageUsers: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adsCounts, setAdsCounts] = useState<Record<string, number>>({});
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedUserDetails, setSelectedUserDetails] = useState<User | null>(null);

  // Fetch users from backend
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        const result = await client.query({
          query: GET_ALL_USERS,
          fetchPolicy: 'network-only',
        });
        
        const userData = result.data.getAllUsers;
        
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
        
        // Fetch ads count for each user
        fetchAdsCounts(transformedUsers);
      } catch (err: any) {
        const errorMessage = err.message || 'Unknown error';
        setError('Failed to fetch users: ' + errorMessage);
        console.error('Error fetching users:', err);
        
        // Log more detailed error information
        if (err.networkError && err.networkError.result) {
          console.error('GraphQL errors:', err.networkError.result.errors);
        }
        if (err.graphQLErrors) {
          console.error('GraphQL errors:', err.graphQLErrors);
          err.graphQLErrors.forEach((graphQLError: any, index: number) => {
            console.error(`GraphQL Error ${index + 1}:`, graphQLError);
          });
        }
        
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  // Fetch ads counts for all users
  const fetchAdsCounts = async (usersList: User[]) => {
    try {
      const counts: Record<string, number> = {};
      
      // Create an array of promises for all ads count queries
      const adsCountPromises = usersList.map(async (user) => {
        try {
          const result = await client.query({
            query: GET_USER_ADS_COUNT,
            variables: { userId: user.id },
          });
          
          counts[user.id] = result.data.getUserById.ads.length;
        } catch (err) {
          console.error(`Error fetching ads count for user ${user.id}:`, err);
          counts[user.id] = 0;
        }
      });
      
      // Wait for all promises to resolve
      await Promise.all(adsCountPromises);
      
      // Update the ads counts state
      setAdsCounts(counts);
      
      // Update users with their ads counts
      setUsers(prevUsers => 
        prevUsers.map(user => ({
          ...user,
          adsCount: counts[user.id] || 0
        }))
      );
    } catch (err) {
      console.error('Error fetching ads counts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        const result = await client.mutate({
          mutation: DELETE_USER,
          variables: { id },
        });
        
        if (result.data.deleteUser.success) {
          // Remove the user from the local state
          setUsers(prev => prev.filter((user) => user.id !== id));
          // Remove from selected users if it was selected
          setSelectedUsers(prev => prev.filter(userId => userId !== id));
          alert('User deleted successfully');
        } else {
          alert('Failed to delete user: ' + result.data.deleteUser.message);
        }
      } catch (err: any) {
        alert('Error deleting user: ' + (err.message || 'Unknown error'));
        console.error('Error deleting user:', err);
      }
    }
  };

  // Handle view details
  const handleViewDetails = (user: User) => {
    setSelectedUserDetails(user);
    setShowDetailsModal(true);
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
    <div className="min-h-screen bg-gray-100 pl-64 pr-5 p-10">
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
              className="bg-white border-t border-gray-300 transition-colors cursor-pointer"
            >
              <div className="grid grid-cols-12 gap-4 items-center px-4 py-3 text-sm hover:bg-gray-100">
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
                    onClick={() => handleViewDetails(user)}
                    className="bg-blue-500 text-white text-xs px-2 py-1 rounded hover:bg-blue-600"
                    title="View Details"
                  >
                    <Eye size={12} />
                  </button>
                  <button 
                    onClick={() => handleDelete(user.id)}
                    className="bg-red-600 text-white text-xs px-2 py-1 rounded hover:bg-red-700"
                    title="Delete"
                  >
                    <TrashIcon className="w-3 h-3" />
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

        {/* Details Modal */}
        {showDetailsModal && selectedUserDetails && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto m-4">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-16 h-16 text-2xl font-bold text-white rounded-full bg-[#FF9D3D]">
                    {getInitials(selectedUserDetails.firstName, selectedUserDetails.lastName)}
                  </div>
                  <h2 className="text-2xl font-bold">User Details</h2>
                </div>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={24} />
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <h3 className="text-lg font-semibold mb-3">Personal Information</h3>
                  <div className="space-y-2">
                    <p><strong>User ID:</strong> {selectedUserDetails.id}</p>
                    <p><strong>Full Name:</strong> {`${selectedUserDetails.firstName} ${selectedUserDetails.middleName} ${selectedUserDetails.lastName}`}</p>
                    <p><strong>Email:</strong> {selectedUserDetails.email}</p>
                    <p><strong>Contact:</strong> {selectedUserDetails.contact}</p>
                    <p><strong>Company:</strong> {selectedUserDetails.company}</p>
                    <p><strong>Address:</strong> {selectedUserDetails.address}</p>
                    <p><strong>City:</strong> {selectedUserDetails.city}</p>
                    {selectedUserDetails.houseAddress && (
                      <p><strong>House Address:</strong> {selectedUserDetails.houseAddress}</p>
                    )}
                    <p><strong>Status:</strong> 
                      <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${
                        selectedUserDetails.status === 'active'
                          ? 'bg-green-200 text-green-800'
                          : 'bg-red-200 text-red-800'
                      }`}>
                        {selectedUserDetails.status.toUpperCase()}
                      </span>
                    </p>
                    <p><strong>Email Verified:</strong> {selectedUserDetails.isEmailVerified ? 'Yes' : 'No'}</p>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold mb-3">System Information</h3>
                  <div className="space-y-2">
                    <p><strong>Role:</strong> {selectedUserDetails.role}</p>
                    <p><strong>Ads Count:</strong> {selectedUserDetails.adsCount}</p>
                    <p><strong>Riders Count:</strong> {selectedUserDetails.ridersCount}</p>
                    <p><strong>Last Login:</strong> {formatDate(selectedUserDetails.lastLogin)}</p>
                    <p><strong>Created At:</strong> {formatDate(selectedUserDetails.createdAt)}</p>
                    <p><strong>Updated At:</strong> {formatDate(selectedUserDetails.updatedAt)}</p>
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-3">Contact Information</h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Mail size={16} className="text-gray-600" />
                    <span>{selectedUserDetails.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone size={16} className="text-gray-600" />
                    <span>{selectedUserDetails.contact}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin size={16} className="text-gray-600" />
                    <span>{selectedUserDetails.address}, {selectedUserDetails.city}</span>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-4 mt-6 pt-4 border-t">
                <button
                  className="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600"
                  onClick={() => {
                    // TODO: Implement edit functionality
                    console.log('Edit user:', selectedUserDetails.id);
                  }}
                >
                  Edit User
                </button>
                <button
                  className="bg-red-500 text-white px-6 py-2 rounded hover:bg-red-600"
                  onClick={() => {
                    setShowDetailsModal(false);
                    handleDelete(selectedUserDetails.id);
                  }}
                >
                  Delete User
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManageUsers;