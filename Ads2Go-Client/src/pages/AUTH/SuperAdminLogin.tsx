import React, { useState, useEffect, ChangeEvent } from 'react';
import { Search, Trash2, Pencil, UserPlus, ArrowUp, ArrowDown } from 'lucide-react';
import { useQuery, useMutation, gql } from '@apollo/client';
import { Admin, Toast } from '../../types/admin.types';
import { GET_ALL_ADMINS } from '../../graphql/queries/getAllAdmins';
import { CREATE_ADMIN_USER } from '../../graphql/mutations/createAdminUser';
import { UPDATE_USER } from '../../graphql/mutations/updateUser';
import { DELETE_USER } from '../../graphql/mutations/deleteUser';

const SadminDashboard: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [showCreateAdminPopup, setShowCreateAdminPopup] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [adminToDelete, setAdminToDelete] = useState<Admin | null>(null);
  const [adminToEdit, setAdminToEdit] = useState<Admin | null>(null);
  const [newAdminFormData, setNewAdminFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    companyName: '',
    companyAddress: '',
    contactNumber: '+63 ',
  });
  const [editAdminFormData, setEditAdminFormData] = useState({
    id: '',
    firstName: '',
    lastName: '',
    email: '',
    contactNumber: '',
    companyName: '',
    companyAddress: '',
  });
  const [editErrors, setEditErrors] = useState<{ [key: string]: string }>({
    firstName: '',
    lastName: '',
    email: '',
    contactNumber: '',
    companyName: '',
    companyAddress: '',
  });
  const [newAdminErrors, setNewAdminErrors] = useState<{ [key: string]: string }>({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    companyName: '',
    companyAddress: '',
    contactNumber: '',
  });

const { loading, error, data, refetch } = useQuery(GET_ALL_ADMINS);

  const [createAdminMutation] = useMutation(CREATE_ADMIN_USER, {
    onCompleted: (data) => {
      if (data.createAdminUser.success) {
        addToast(data.createAdminUser.message, 'success');
        refetch();
        setShowCreateAdminPopup(false);
        setNewAdminFormData({
          firstName: '',
          lastName: '',
          email: '',
          password: '',
          companyName: '',
          companyAddress: '',
          contactNumber: '+63 ',
        });
        setNewAdminErrors({
          firstName: '',
          lastName: '',
          email: '',
          password: '',
          companyName: '',
          companyAddress: '',
          contactNumber: '',
        });
      } else {
        addToast(data.createAdminUser.message, 'error');
      }
    },
    onError: (err) => {
      addToast(`Error creating admin: ${err.message}`, 'error');
    },
  });

  const [updateUserMutation] = useMutation(UPDATE_USER, {
    onCompleted: (data) => {
      if (data.updateUser.success) {
        addToast(data.updateUser.message, 'success');
        refetch();
        setAdminToEdit(null);
      } else {
        addToast(data.updateUser.message, 'error');
      }
    },
    onError: (err) => {
      addToast(`Error updating admin: ${err.message}`, 'error');
    },
  });

  const [deleteUserMutation] = useMutation(DELETE_USER, {
    onCompleted: (data) => {
      if (data.deleteUser.success) {
        addToast(data.deleteUser.message, 'success');
        refetch();
        setAdminToDelete(null);
      } else {
        addToast(data.deleteUser.message, 'error');
      }
    },
    onError: (err) => {
      addToast(`Error deleting admin: ${err.message}`, 'error');
    },
  });

  // Log fetched data for debugging
  useEffect(() => {
    if (data && data.getAllUsers) {
      console.log('Fetched getAllUsers data:', data.getAllUsers);
      const adminUsers = data.getAllUsers.filter((user: Admin) => user.role === 'ADMIN');
      console.log('Filtered admin users:', adminUsers);
      setAdmins(adminUsers);
    }
  }, [data]);

  const formatDate = (dateInput: any): string => {
    console.log('formatDate: Raw input:', JSON.stringify(dateInput), 'Type:', typeof dateInput);

    // Test with a hardcoded date to verify formatting
    const testDate = new Date('2025-07-28T00:00:00.000Z');
    console.log('formatDate: Test date:', testDate, '->', testDate.toISOString().split('T')[0]);

    // Handle null or undefined
    if (!dateInput) {
      console.log('formatDate: No date input provided');
      return 'N/A';
    }

    try {
      let date: Date;

      // Handle MongoDB Date object (e.g., { $date: "2025-05-01T08:36:56.546Z" })
      if (typeof dateInput === 'object' && dateInput?.$date) {
        console.log('formatDate: Detected MongoDB Date object:', dateInput.$date);
        date = new Date(dateInput.$date);
      }
      // Handle ISO string or timestamp
      else if (typeof dateInput === 'string' || typeof dateInput === 'number') {
        date = new Date(dateInput);
        console.log(
          'formatDate: Parsed input:',
          dateInput,
          '->',
          date,
          'Type:',
          typeof dateInput
        );
      }
      // Handle unexpected types
      else {
        console.log('formatDate: Invalid input type:', typeof dateInput);
        return 'N/A';
      }

      // Validate parsed date
      if (isNaN(date.getTime())) {
        console.log('formatDate: Invalid date after parsing:', dateInput);
        return 'N/A';
      }

      const formattedDate = date.toISOString().split('T')[0];
      console.log('formatDate: Formatted output:', formattedDate);
      return formattedDate; // Returns YYYY-MM-DD
    } catch (error: any) {
      console.log('formatDate: Error parsing date:', error.message, 'Input:', JSON.stringify(dateInput));
      return 'N/A';
    }
  };

  const filteredAndSortedAdmins = admins
    .filter((admin) => {
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      const createdAtString = admin.createdAt ? String(admin.createdAt) : '';
      return (
        admin.firstName.toLowerCase().includes(lowerCaseSearchTerm) ||
        admin.lastName.toLowerCase().includes(lowerCaseSearchTerm) ||
        admin.email.toLowerCase().includes(lowerCaseSearchTerm) ||
        (admin.companyName && admin.companyName.toLowerCase().includes(lowerCaseSearchTerm)) ||
        (admin.companyAddress && admin.companyAddress.toLowerCase().includes(lowerCaseSearchTerm)) ||
        (admin.contactNumber && admin.contactNumber.toLowerCase().includes(lowerCaseSearchTerm)) ||
        createdAtString.toLowerCase().includes(lowerCaseSearchTerm)
      );
    })
    .sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();

      if (isNaN(dateA) && isNaN(dateB)) return 0;
      if (isNaN(dateA)) return 1;
      if (isNaN(dateB)) return -1;

      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });

  const addToast = (message: string, type: 'error' | 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 3000);
  };

  // Validation and form handling functions (unchanged)
  const validateNewAdminForm = (): boolean => {
    let isValid = true;
    const errors: { [key: string]: string } = {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      companyName: '',
      companyAddress: '',
      contactNumber: '',
    };

    const nameRegex = /^[A-Za-z\s]+$/;
    if (!newAdminFormData.firstName.trim() || !nameRegex.test(newAdminFormData.firstName)) {
      errors.firstName = 'First Name should not contain numbers or symbols and cannot be empty.';
      isValid = false;
    }
    if (!newAdminFormData.lastName.trim() || !nameRegex.test(newAdminFormData.lastName)) {
      errors.lastName = 'Last Name should not contain numbers or symbols and cannot be empty.';
      isValid = false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!newAdminFormData.email.trim() || !emailRegex.test(newAdminFormData.email)) {
      errors.email = 'Please enter a valid email address.';
      isValid = false;
    }

    if (!newAdminFormData.password.trim()) {
      errors.password = 'Password is required.';
      isValid = false;
    }

    const phoneRegex = /^\+63\s?\d{10}$/;
    if (!phoneRegex.test(newAdminFormData.contactNumber)) {
      errors.contactNumber = 'Please provide a valid phone number (e.g., +63 9123456789).';
      isValid = false;
    }

    if (!newAdminFormData.companyName.trim()) {
      errors.companyName = 'Company Name is required.';
      isValid = false;
    }
    if (!newAdminFormData.companyAddress.trim()) {
      errors.companyAddress = 'Company Address is required.';
      isValid = false;
    }

    setNewAdminErrors(errors);
    return isValid;
  };

  const handleNewAdminChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    let updatedValue = value;

    if (name === 'contactNumber') {
      const digitsOnly = value.replace(/\D/g, '');
      const limitedDigits = digitsOnly.slice(0, 10);
      updatedValue = `+63 ${limitedDigits}`;
    }

    setNewAdminFormData((prev) => ({ ...prev, [name]: updatedValue }));
    if (newAdminErrors[name]) {
      setNewAdminErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleNewAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateNewAdminForm()) {
      return;
    }

    try {
      await createAdminMutation({
        variables: {
          input: {
            firstName: newAdminFormData.firstName,
            lastName: newAdminFormData.lastName,
            email: newAdminFormData.email,
            password: newAdminFormData.password,
            companyName: newAdminFormData.companyName,
            companyAddress: newAdminFormData.companyAddress,
            contactNumber: newAdminFormData.contactNumber,
          },
        },
      });
    } catch (err) {
      // Error handled by onError in useMutation
    }
  };

  const confirmDeleteAdmin = (admin: Admin) => {
    setAdminToDelete(admin);
  };

  const executeDeleteAdmin = async () => {
    if (adminToDelete) {
      try {
        await deleteUserMutation({ variables: { id: adminToDelete.id } });
      } catch (err) {
        // Error handled by onError in useMutation
      }
    }
  };

  const handleEditAdmin = (admin: Admin) => {
    setAdminToEdit(admin);
    const initialContactNumber = admin.contactNumber && admin.contactNumber.startsWith('+63 ')
      ? admin.contactNumber
      : admin.contactNumber
      ? `+63 ${admin.contactNumber.replace(/\D/g, '').slice(0, 10)}`
      : '+63 ';
    setEditAdminFormData({
      id: admin.id,
      firstName: admin.firstName,
      lastName: admin.lastName,
      email: admin.email,
      contactNumber: initialContactNumber,
      companyName: admin.companyName || '',
      companyAddress: admin.companyAddress || '',
    });
    setEditErrors({
      firstName: '',
      lastName: '',
      email: '',
      contactNumber: '',
      companyName: '',
      companyAddress: '',
    });
  };

  const handleEditAdminChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    let updatedValue = value;

    if (name === 'contactNumber') {
      const digitsOnly = value.replace(/\D/g, '');
      const limitedDigits = digitsOnly.slice(0, 10);
      updatedValue = `+63 ${limitedDigits}`;
    }

    setEditAdminFormData((prev) => ({ ...prev, [name]: updatedValue }));
    if (editErrors[name]) {
      setEditErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validateEditForm = (): boolean => {
    let isValid = true;
    const newErrors: { [key: string]: string } = {
      firstName: '',
      lastName: '',
      email: '',
      contactNumber: '',
      companyName: '',
      companyAddress: '',
    };

    const nameRegex = /^[A-Za-z\s]+$/;
    if (!editAdminFormData.firstName.trim() || !nameRegex.test(editAdminFormData.firstName)) {
      newErrors.firstName = 'First Name should not contain numbers or symbols and cannot be empty.';
      isValid = false;
    }
    if (!editAdminFormData.lastName.trim() || !nameRegex.test(editAdminFormData.lastName)) {
      newErrors.lastName = 'Last Name should not contain numbers or symbols and cannot be empty.';
      isValid = false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!editAdminFormData.email.trim() || !emailRegex.test(editAdminFormData.email)) {
      newErrors.email = 'Please enter a valid email address.';
      isValid = false;
    }

    const phoneRegex = /^\+63\s?\d{10}$/;
    if (!phoneRegex.test(editAdminFormData.contactNumber)) {
      newErrors.contactNumber = 'Please provide a valid phone number (e.g., +63 9123456789).';
      isValid = false;
    }

    if (!editAdminFormData.companyName.trim()) {
      newErrors.companyName = 'Company Name is required.';
      isValid = false;
    }
    if (!editAdminFormData.companyAddress.trim()) {
      newErrors.companyAddress = 'Company Address is required.';
      isValid = false;
    }

    setEditErrors(newErrors);
    return isValid;
  };

  const handleUpdateAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (adminToEdit) {
      if (!validateEditForm()) {
        return;
      }

      try {
        await updateUserMutation({
          variables: {
            input: {
              id: editAdminFormData.id,
              firstName: editAdminFormData.firstName,
              lastName: editAdminFormData.lastName,
              email: editAdminFormData.email,
              contactNumber: editAdminFormData.contactNumber,
              companyName: editAdminFormData.companyName,
              companyAddress: editAdminFormData.companyAddress,
            },
          },
        });
      } catch (err) {
        // Error handled by onError in useMutation
      }
    }
  };

  const handleCancelEdit = () => {
    setAdminToEdit(null);
    setEditErrors({
      firstName: '',
      lastName: '',
      email: '',
      contactNumber: '',
      companyName: '',
      companyAddress: '',
    });
  };

  const handleCancelCreateAdmin = () => {
    setShowCreateAdminPopup(false);
    setNewAdminFormData({
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      companyName: '',
      companyAddress: '',
      contactNumber: '+63 ',
    });
    setNewAdminErrors({
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      companyName: '',
      companyAddress: '',
      contactNumber: '',
    });
  };

  if (loading) return <p className="ml-64 p-8">Loading admins...</p>;
  if (error) {
    console.log('GraphQL query error:', error);
    return <p className="ml-64 p-8 text-red-500">Error: {error.message}</p>;
  }

  return (
    <div className="min-h-screen ml-64 bg-gray-100 pb-5">
      {/* Header Section */}
      <div className="p-6 pb-0 flex justify-between items-end">
        <div>
          <h1 className="text-4xl mt-8 font-semibold text-gray-800">Admins</h1>
          <p className="text-gray-600 mt-2">Manage your admin accounts</p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search admins..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-3xl text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <button
            onClick={() => setShowCreateAdminPopup(true)}
            className="flex items-center bg-[#3674B5] text-white text-xs space-x-2 px-4 py-3 border border-gray-300 rounded-3xl text-gray-700 hover:bg-[#0E2A47] transition-colors"
          >
            <UserPlus size={18} />
            <span>Add New Admin</span>
          </button>
          <button
            onClick={() => setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest')}
            className="flex items-center space-x-2 px-4 py-3 border border-white rounded-3xl bg-[#1b5087] text-white text-xs hover:bg-[#0E2A47] transition-colors"
          >
            {sortOrder === 'newest' ? <ArrowUp size={18} /> : <ArrowDown size={18} />}
            <span>{sortOrder === 'newest' ? 'Newest' : 'Oldest'}</span>
          </button>
        </div>
      </div>

      {/* Admins List */}
      <div className="mx-6 mt-4 rounded-xl overflow-hidden">
        <div className="grid grid-cols-[1.5fr_1fr_1fr_1.5fr_1fr_0.5fr] gap-4 px-6 py-3 text-sm font-semibold text-[#3674B5] bg-gray-100">
          <span>Name</span>
          <span>Company Address</span>
          <span>Contact</span>
          <span>Email</span>
          <span>Date Created</span>
          <span className="text-center">Actions</span>
        </div>
        {filteredAndSortedAdmins.length > 0 ? (
          <ul className="space-y-3 pb-5">
            {filteredAndSortedAdmins.map((admin) => (
              <li
                key={admin.id}
                className="group grid grid-cols-[1.5fr_1fr_1fr_1.5fr_1fr_0.5fr] gap-4 px-6 py-4 bg-white rounded-xl h-20 shadow-md items-center hover:bg-[#3674B5] transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-sm font-semibold group-hover:bg-white group-hover:text-[#3674B5]">
                    {admin.firstName.charAt(0)}
                    {admin.lastName.charAt(0)}
                  </div>
                  <p className="font-medium text-gray-900 group-hover:text-white">
                    {admin.firstName} {admin.lastName}
                  </p>
                </div>
                <p className="text-sm text-gray-900 group-hover:text-white">{admin.companyAddress || 'N/A'}</p>
                <p className="text-sm text-gray-900 group-hover:text-white">{admin.contactNumber || 'N/A'}</p>
                <p className="text-sm text-gray-900 truncate group-hover:text-white">{admin.email}</p>
                <div className="text-sm text-gray-600 group-hover:text-white">
                  <span>{formatDate(admin.createdAt)}</span>
                </div>
                <div className="flex justify-center space-x-2">
                  <button
                    onClick={() => handleEditAdmin(admin)}
                    className="p-2 rounded-full hover:bg-[#0E2A47] group-hover:text-white"
                  >
                    <Pencil size={18} />
                  </button>
                  <button
                    onClick={() => confirmDeleteAdmin(admin)}
                    className="p-2 rounded-full hover:bg-[#0E2A47] group-hover:text-white"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-center py-8 text-gray-500">No admins found.</div>
        )}
      </div>

      {/* New Admin Popup */}
      {showCreateAdminPopup && (
        <div className="fixed inset-0 z-50 flex justify-end pr-2">
          <div
            className="fixed inset-0 bg-black bg-opacity-30"
            onClick={handleCancelCreateAdmin}
          ></div>
          <div className="relative w-full md:w-1/2 lg:w-1/3 max-w-xl h-full pb-6 rounded-l-3xl bg-gray-100 shadow-lg transform transition-transform duration-300 ease-in-out animate-slideIn">
            <div className="p-6 h-full overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-[#3674B5]">Add New Admin</h2>
                <button
                  onClick={handleCancelCreateAdmin}
                  className="text-gray-500 hover:text-gray-700"
                ></button>
              </div>
              <form onSubmit={handleNewAdminSubmit} className="space-y-4 mt-9">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                  <div>
                    <label htmlFor="newAdminFirstName" className="block text-sm font-medium text-gray-500 mb-1">
                      First Name
                    </label>
                    <input
                      id="newAdminFirstName"
                      type="text"
                      name="firstName"
                      value={newAdminFormData.firstName}
                      onChange={handleNewAdminChange}
                      className="w-full py-2 border-b border-[#3674B5] focus:outline-none focus:border-[#3674B5] transition-colors bg-transparent"
                      required
                    />
                    {newAdminErrors.firstName && (
                      <p className="text-red-500 text-xs mt-1">{newAdminErrors.firstName}</p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="newAdminLastName" className="block text-sm font-medium text-gray-500 mb-1">
                      Last Name
                    </label>
                    <input
                      id="newAdminLastName"
                      type="text"
                      name="lastName"
                      value={newAdminFormData.lastName}
                      onChange={handleNewAdminChange}
                      className="w-full py-2 border-b border-[#3674B5] focus:outline-none focus:border-[#3674B5] transition-colors bg-transparent"
                      required
                    />
                    {newAdminErrors.lastName && (
                      <p className="text-red-500 text-xs mt-1">{newAdminErrors.lastName}</p>
                    )}
                  </div>
                </div>
                <div>
                  <label htmlFor="newAdminEmail" className="block text-sm font-medium text-gray-500 mb-1">
                    Email
                  </label>
                  <input
                    id="newAdminEmail"
                    type="email"
                    name="email"
                    value={newAdminFormData.email}
                    onChange={handleNewAdminChange}
                    className="w-full py-2 border-b border-[#3674B5] focus:outline-none focus:border-[#3674B5] transition-colors bg-transparent"
                    required
                  />
                  {newAdminErrors.email && (
                    <p className="text-red-500 text-xs mt-1">{newAdminErrors.email}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="newAdminPassword" className="block text-sm font-medium text-gray-500 mb-1">
                    Password
                  </label>
                  <input
                    id="newAdminPassword"
                    type="password"
                    name="password"
                    value={newAdminFormData.password}
                    onChange={handleNewAdminChange}
                    className="w-full py-2 border-b border-[#3674B5] focus:outline-none focus:border-[#3674B5] transition-colors bg-transparent"
                    required
                  />
                  {newAdminErrors.password && (
                    <p className="text-red-500 text-xs mt-1">{newAdminErrors.password}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="newAdminCompanyName" className="block text-sm font-medium text-gray-500 mb-1">
                    Company Name
                  </label>
                  <input
                    id="newAdminCompanyName"
                    type="text"
                    name="companyName"
                    value={newAdminFormData.companyName}
                    onChange={handleNewAdminChange}
                    className="w-full py-2 border-b border-[#3674B5] focus:outline-none focus:border-[#3674B5] transition-colors bg-transparent"
                    required
                  />
                  {newAdminErrors.companyName && (
                    <p className="text-red-500 text-xs mt-1">{newAdminErrors.companyName}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="newAdminCompanyAddress" className="block text-sm font-medium text-gray-500 mb-1">
                    Company Address
                  </label>
                  <input
                    id="newAdminCompanyAddress"
                    type="text"
                    name="companyAddress"
                    value={newAdminFormData.companyAddress}
                    onChange={handleNewAdminChange}
                    className="w-full py-2 border-b border-[#3674B5] focus:outline-none focus:border-[#3674B5] transition-colors bg-transparent"
                    required
                  />
                  {newAdminErrors.companyAddress && (
                    <p className="text-red-500 text-xs mt-1">{newAdminErrors.companyAddress}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="newAdminContactNumber" className="block text-sm font-medium text-gray-500 mb-1">
                    Phone Number
                  </label>
                  <div className="flex items-center py-2 border-b border-[#3674B5] focus-within:border-[#3674B5] transition-colors">
                    <span className="text-gray-700 select-none pr-1">+63</span>
                    <input
                      id="newAdminContactNumber"
                      name="contactNumber"
                      type="tel"
                      value={newAdminFormData.contactNumber.replace('+63 ', '')}
                      onChange={handleNewAdminChange}
                      maxLength={10}
                      className="flex-grow focus:outline-none bg-transparent"
                      required
                    />
                  </div>
                  {newAdminErrors.contactNumber && (
                    <p className="text-red-500 text-xs mt-1">{newAdminErrors.contactNumber}</p>
                  )}
                </div>
                <div className="w-full py-2 text-gray-500 font-medium">Role: Admin</div>
                <div className="flex justify-between pt-4">
                  <button
                    type="button"
                    onClick={handleCancelCreateAdmin}
                    className="px-5 py-2 rounded-lg hover:bg-gray-200 border border-gray-300 text-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={Object.values(newAdminErrors).some((error) => error !== '')}
                    className="px-6 py-2 rounded-lg bg-[#3674B5] hover:bg-[#0E2A47] text-white font-semibold shadow hover:scale-105 transition-all duration-300 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    Create Admin
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Admin Popup */}
      {adminToEdit && (
        <div className="fixed inset-0 z-50 flex items-end justify-end p-4">
          <div className="bg-[#3674B5] p-8 rounded-lg shadow-xl max-w-sm w-full transform transition-transform duration-300 ease-in-out animate-slideIn">
            <h3 className="text-xl font-semibold text-white mb-4">Edit Admin</h3>
            <p className="text-white mb-6">
              Are you sure you want to delete admin{' '}
              <span className="font-bold">
                {adminToDelete?.firstName} {adminToDelete?.lastName}
              </span>
              ? This action cannot be undone.
            </p>
            <div className="flex justify-between pt-4">
              <button
                onClick={() => setAdminToDelete(null)}
                className="px-5 py-2 rounded-lg hover:bg-gray-400 hover:text-black border border-gray-300 text-white"
              >
                Cancel
              </button>
              <button
                onClick={executeDeleteAdmin}
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {adminToDelete && (
        <div className="fixed bottom-4 right-4 z-50 flex items-end justify-end">
          <div className="bg-[#3674B5] p-8 rounded-lg shadow-xl max-w-sm w-full transform transition-transform duration-300 ease-in-out animate-slideIn">
            <h3 className="text-xl font-semibold text-white mb-4">Edit Admin</h3>
            <form onSubmit={handleUpdateAdminSubmit} className="space-y-4 mt-9">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                <div>
                  <label htmlFor="editFirstName" className="block text-sm font-medium text-gray-500 mb-1">
                    First Name
                  </label>
                  <input
                    id="editFirstName"
                    name="firstName"
                    type="text"
                    value={editAdminFormData.firstName}
                    onChange={handleEditAdminChange}
                    className="w-full py-2 border-b border-[#3674B5] focus:outline-none focus:border-[#3674B5] transition-colors bg-transparent"
                    required
                  />
                  {editErrors.firstName && (
                    <p className="text-red-500 text-xs mt-1">{editErrors.firstName}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="editLastName" className="block text-sm font-medium text-gray-500 mb-1">
                    Last Name
                  </label>
                  <input
                    id="editLastName"
                    name="lastName"
                    type="text"
                    value={editAdminFormData.lastName}
                    onChange={handleEditAdminChange}
                    className="w-full py-2 border-b border-[#3674B5] focus:outline-none focus:border-[#3674B5] transition-colors bg-transparent"
                    required
                  />
                  {editErrors.lastName && (
                    <p className="text-red-500 text-xs mt-1">{editErrors.lastName}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="editEmail" className="block text-sm font-medium text-gray-500 mb-1">
                    Email Address
                  </label>
                  <input
                    id="editEmail"
                    name="email"
                    type="email"
                    value={editAdminFormData.email}
                    onChange={handleEditAdminChange}
                    className="w-full py-2 border-b border-[#3674B5] focus:outline-none focus:border-[#3674B5] transition-colors bg-transparent"
                    required
                  />
                  {editErrors.email && <p className="text-red-500 text-xs mt-1">{editErrors.email}</p>}
                </div>
                <div>
                  <label htmlFor="editContactNumber" className="block text-sm font-medium text-gray-500 mb-1">
                    Phone Number
                  </label>
                  <div className="flex items-center py-2 border-b border-[#3674B5] focus-within:border-[#3674B5] transition-colors">
                    <span className="text-gray-700 select-none pr-1">+63</span>
                    <input
                      id="editContactNumber"
                      name="contactNumber"
                      type="tel"
                      value={editAdminFormData.contactNumber.replace('+63 ', '')}
                      onChange={handleEditAdminChange}
                      maxLength={10}
                      className="flex-grow focus:outline-none bg-transparent"
                      required
                    />
                  </div>
                  {editErrors.contactNumber && (
                    <p className="text-red-500 text-xs mt-1">{editErrors.contactNumber}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="editCompanyName" className="block text-sm font-medium text-gray-500 mb-1">
                    Company Name
                  </label>
                  <input
                    id="editCompanyName"
                    name="companyName"
                    type="text"
                    value={editAdminFormData.companyName}
                    onChange={handleEditAdminChange}
                    className="w-full py-2 border-b border-[#3674B5] focus:outline-none focus:border-[#3674B5] transition-colors bg-transparent"
                    required
                  />
                  {editErrors.companyName && (
                    <p className="text-red-500 text-xs mt-1">{editErrors.companyName}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="editCompanyAddress" className="block text-sm font-medium text-gray-500 mb-1">
                    Company Address
                  </label>
                  <input
                    id="editCompanyAddress"
                    name="companyAddress"
                    type="text"
                    value={editAdminFormData.companyAddress}
                    onChange={handleEditAdminChange}
                    className="w-full py-2 border-b border-[#3674B5] focus:outline-none focus:border-[#3674B5] transition-colors bg-transparent"
                    required
                  />
                  {editErrors.companyAddress && (
                    <p className="text-red-500 text-xs mt-1">{editErrors.companyAddress}</p>
                  )}
                </div>
              </div>
              <div className="flex justify-between pt-4">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="px-5 py-2 rounded-lg hover:bg-gray-200 border border-gray-300 text-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={Object.values(editErrors).some((error) => error !== '')}
                  className="bg-[#3674B5] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[#1b5087] transition-colors shadow-md disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  Update Admin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`px-4 py-2 rounded-lg shadow-md text-white ${
              toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>

      <style>
        {`
          @keyframes slideIn {
            from {
              transform: translateX(100%);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }
          .animate-slideIn {
            animation: slideIn 0.3s ease-out;
          }
        `}
      </style>
    </div>
  );
};

export default SadminDashboard;