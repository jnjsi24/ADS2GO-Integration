import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@apollo/client';
// SadminAdmin specific GraphQL operations
import { GET_ALL_ADMINS, Admin } from '../../graphql/superadmin/queries/sadminAdminQueries';
import { CREATE_ADMIN, UPDATE_ADMIN, DELETE_ADMIN } from '../../graphql/superadmin/mutations/sadminAdminMutations';
import { uploadAdminProfilePicture } from '../../utils/fileUpload';

// Import components from tabs/SadminAdmin
import {
  AdminSearchHeader,
  AdminList,
  CreateAdminModal,
  EditAdminModal,
  DeleteAdminModal,
  ToastNotifications, 
  AdminFormData,
  EditAdminFormData,
  FormErrors,
  EditErrors,
  Toast,
  formatDate,
  validateNewAdminForm,
  validateEditForm
} from './tabs/SadminAdmin';

const SadminDashboard: React.FC = () => {
  // State management
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [showCreateAdminPopup, setShowCreateAdminPopup] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [adminToDelete, setAdminToDelete] = useState<Admin | null>(null);
  const [adminToEdit, setAdminToEdit] = useState<Admin | null>(null);

  const [newAdminFormData, setNewAdminFormData] = useState<AdminFormData>({
    firstName: '',
    middleName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    companyName: '',
    companyAddress: '',
    contactNumber: '',
    profilePicture: null as File | null,
  });

  const [editAdminFormData, setEditAdminFormData] = useState<EditAdminFormData>({
    id: '',
    firstName: '',
    middleName: '',
    lastName: '',
    email: '',
    contactNumber: '',
    companyName: '',
    companyAddress: '',
    password: '',
    profilePicture: null as File | null,
  });

  const [editErrors, setEditErrors] = useState<EditErrors>({
    firstName: '',
    lastName: '',
    email: '',
    contactNumber: '',
    companyName: '',
    companyAddress: '',
  });

  const [newAdminErrors, setNewAdminErrors] = useState<FormErrors>({
    firstName: '',
    middleName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    companyName: '',
    companyAddress: '',
    contactNumber: '',
  });

  // ===== GRAPHQL QUERIES =====
  const { loading, error, data, refetch } = useQuery(GET_ALL_ADMINS);

  // ===== GRAPHQL MUTATIONS =====
  // Create Admin Mutation
  const [createAdminUser] = useMutation(CREATE_ADMIN, {
    onCompleted: () => {
      addToast('Admin user created successfully!', 'success');
      setShowCreateAdminPopup(false);
      resetNewAdminForm();
      refetch();
    },
    onError: (error) => {
      addToast(`Error creating admin: ${error.message}`, 'error');
    }
  });

  // Update Admin Mutation
  const [updateAdminUser] = useMutation(UPDATE_ADMIN, {
    onCompleted: () => {
      addToast('Admin user updated successfully!', 'success');
      setAdminToEdit(null);
      refetch();
    },
    onError: (error) => {
      addToast(`Error updating admin: ${error.message}`, 'error');
    }
  });

  // Delete Admin Mutation
  const [deleteAdminMutation] = useMutation(DELETE_ADMIN, {
    onCompleted: () => {
      addToast('Admin user deleted successfully!', 'success');
      setAdminToDelete(null);
      refetch();
    },
    onError: (error) => {
      addToast(`Error deleting admin: ${error.message}`, 'error');
    }
  });

// Set admins filtered by role ADMIN whenever data changes
useEffect(() => {
  if (data && data.getAllAdmins && data.getAllAdmins.admins) {
    const adminUsers = data.getAllAdmins.admins.filter((user: Admin) => user.role === 'ADMIN');
      console.log('Admin data from server:', adminUsers);
    console.log('Profile pictures:', adminUsers.map((admin: Admin) => ({ 
      name: `${admin.firstName} ${admin.lastName}`, 
      profilePicture: admin.profilePicture 
    })));
    setAdmins(adminUsers);
  }
}, [data]);

  // Helper to reset new admin form and errors
  const resetNewAdminForm = () => {
    setNewAdminFormData({
      firstName: '',
      middleName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
      companyName: '',
      companyAddress: '',
      contactNumber: '',
      profilePicture: null,
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

  // Toast helpers
  const addToast = (message: string, type: 'error' | 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const removeToast = (id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  // Handle form input changes
  const handleNewAdminChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    if (name === 'contactNumber') {
      // Allow only digits and limit to 11 characters
      const digits = value.replace(/\D/g, '').slice(0, 11);
      setNewAdminFormData(prev => ({
        ...prev,
        [name]: digits
      }));
    } else {
      setNewAdminFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
    
    // Clear error for this field if it exists
    if (newAdminErrors[name as keyof typeof newAdminErrors]) {
      setNewAdminErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  // Filter and sort admins
  const filteredAndSortedAdmins = admins
    .filter((admin) => {
      const lowerSearch = searchTerm.toLowerCase();
      const createdAtStr = admin.createdAt ? String(admin.createdAt) : '';
      return (
        admin.firstName.toLowerCase().includes(lowerSearch) ||
        admin.lastName.toLowerCase().includes(lowerSearch) ||
        admin.email.toLowerCase().includes(lowerSearch) ||
        (admin.companyName?.toLowerCase().includes(lowerSearch) ?? false) ||
        (admin.companyAddress?.toLowerCase().includes(lowerSearch) ?? false) ||
        (admin.contactNumber?.toLowerCase().includes(lowerSearch) ?? false) ||
        createdAtStr.toLowerCase().includes(lowerSearch)
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

  // Handle new admin form submission
const handleNewAdminSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
  e.preventDefault();
  
  try {
    // Clear any previous errors
    setNewAdminErrors({});
    
    // Validate form data
    console.log('[DEBUG] Starting form validation...');
      const { isValid, errors } = validateNewAdminForm(newAdminFormData);
    
    if (!isValid) {
      console.log('[DEBUG] Form validation failed:', errors);
      setNewAdminErrors(errors);
      addToast('Please fix the errors in the form', 'error');
      return;
    }
    
    console.log('[DEBUG] Form validation passed, preparing data for submission...');
    
         // Handle file upload if profile picture is selected
     let profilePictureUrl = null;
     if (newAdminFormData.profilePicture) {
       try {
         profilePictureUrl = await uploadAdminProfilePicture(newAdminFormData.profilePicture);
       } catch (error) {
         console.error('Error uploading profile picture:', error);
         addToast('Error uploading profile picture. Please try again.', 'error');
         return;
       }
     }

     // Prepare the input object for the API call
     const input = {
       firstName: newAdminFormData.firstName.trim(),
       middleName: newAdminFormData.middleName.trim() || null,
       lastName: newAdminFormData.lastName.trim(),
       email: newAdminFormData.email.toLowerCase(),
       password: newAdminFormData.password,
       companyName: newAdminFormData.companyName.trim(),
       companyAddress: newAdminFormData.companyAddress.trim(),
       contactNumber: newAdminFormData.contactNumber,
       ...(profilePictureUrl && { profilePicture: profilePictureUrl })
     };
    
    // Log the input data (excluding sensitive information)
    if (process.env.NODE_ENV === 'development') {
      console.log('[DEBUG] Calling createAdminUser mutation with input:', {
        ...input,
          password: '***',
          confirmPassword: '***'
      });
    }
    
    try {
      // Call the createAdminUser mutation
      const { data } = await createAdminUser({
        variables: { input },
        refetchQueries: [{ query: GET_ALL_ADMINS }]
      });
      
      if (data?.createAdminUser) {
        // Show success message
        addToast('Admin user created successfully!', 'success');
        
        // Reset the form
        resetNewAdminForm();
        
        // Close the popup
        setShowCreateAdminPopup(false);
        
        // Refresh the admin list
        if (refetch) {
          await refetch();
        }
      }
    } catch (error: unknown) {
      console.error('Error creating admin user:', error);
      
      // Handle GraphQL errors
      if (error && typeof error === 'object' && 'graphQLErrors' in error) {
        const graphQLError = error as { graphQLErrors: Array<{ message: string }> };
        graphQLError.graphQLErrors.forEach(({ message }) => {
          addToast(`Error: ${message}`, 'error');
        });
      } else {
        // Handle network or other errors
        const errorMessage = error instanceof Error ? error.message : 'An error occurred while creating the admin user. Please try again.';
        addToast(errorMessage, 'error');
      }
    }
  } catch (error: unknown) {
    console.error('Unexpected error during form submission:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.';
    addToast(errorMessage, 'error');
    }
  };

  // Delete admin handlers
  const confirmDeleteAdmin = (admin: Admin) => {
    setAdminToDelete(admin);
  };

  const executeDeleteAdmin = async () => {
    if (!adminToDelete) {
      console.error('No admin selected for deletion');
      return;
    }
    
    try {
      await deleteAdminMutation({ variables: { id: adminToDelete.id } });
    } catch {
      // Handled by onError
    }
  };

  // Edit admin handlers
  const handleEditAdmin = (admin: Admin) => {
    setAdminToEdit(admin);
    // Set initialContactNumber to empty string if no contact number exists
    const initialContactNumber = admin.contactNumber
      ? admin.contactNumber.startsWith('+63 ')
        ? admin.contactNumber
        : `+63 ${admin.contactNumber.replace(/\D/g, '').slice(0, 10)}`
      : '';

    setEditAdminFormData({
      id: admin.id,
      firstName: admin.firstName,
      middleName: admin.middleName || '',
      lastName: admin.lastName,
      email: admin.email,
      contactNumber: initialContactNumber,
      companyName: admin.companyName || '',
      companyAddress: admin.companyAddress || '',
      password: '',
      profilePicture: null,
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

const handleUpdateAdminSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!adminToEdit) return;
    if (!validateEditForm(editAdminFormData)) return;

  try {
    // Handle file upload if a new profile picture is selected
    let profilePictureUrl = undefined;
    if (editAdminFormData.profilePicture instanceof File) {
      try {
        profilePictureUrl = await uploadAdminProfilePicture(editAdminFormData.profilePicture);
      } catch (error) {
        console.error('Error uploading profile picture:', error);
        addToast('Error uploading profile picture. Please try again.', 'error');
        return;
      }
    }

    await updateAdminUser({
      variables: {
        adminId: editAdminFormData.id,
        input: {
          firstName: editAdminFormData.firstName,
          middleName: editAdminFormData.middleName || null,
          lastName: editAdminFormData.lastName,
          email: editAdminFormData.email,
          contactNumber: editAdminFormData.contactNumber || undefined,
          companyName: editAdminFormData.companyName,
          companyAddress: editAdminFormData.companyAddress,
          password: editAdminFormData.password || undefined,
          ...(profilePictureUrl && { profilePicture: profilePictureUrl }),
        },
      },
    });
  } catch {
    // Error handled globally by onError
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
    resetNewAdminForm();
  };

  if (loading) return <p className="ml-64 p-8">Loading admins...</p>;
  if (error) {
    console.log('GraphQL query error:', error);
    return <p className="ml-64 p-8 text-red-500">Error: {error.message || 'An error occurred'}</p>;
  }

  return (
    <div className="min-h-screen ml-64 bg-gray-100 pb-5">
      {/* Header Section */}
      <AdminSearchHeader
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        sortOrder={sortOrder}
        setSortOrder={setSortOrder}
        onCreateAdminClick={() => setShowCreateAdminPopup(true)}
      />

      {/* Admins List */}
      <AdminList
        admins={filteredAndSortedAdmins}
        onEditAdmin={handleEditAdmin}
        onDeleteAdmin={confirmDeleteAdmin}
        formatDate={formatDate}
      />

      {/* New Admin Popup */}
      <CreateAdminModal
        isOpen={showCreateAdminPopup}
        onClose={handleCancelCreateAdmin}
        formData={newAdminFormData}
        setFormData={setNewAdminFormData}
        errors={newAdminErrors}
        onSubmit={handleNewAdminSubmit}
        onInputChange={handleNewAdminChange}
      />

      {/* Edit Admin Popup */}
      <EditAdminModal
        isOpen={!!adminToEdit}
        onClose={handleCancelEdit}
        formData={editAdminFormData}
        setFormData={setEditAdminFormData}
        errors={editErrors}
        onSubmit={handleUpdateAdminSubmit}
        onInputChange={handleEditAdminChange}
      />

      {/* Delete Confirmation Modal */}
      <DeleteAdminModal
        isOpen={!!adminToDelete}
        onClose={() => setAdminToDelete(null)}
        onConfirm={executeDeleteAdmin}
        admin={adminToDelete}
      />

      {/* Toast Notifications */}
      <ToastNotifications toasts={toasts} onRemove={removeToast} />

      <style>
        {`
          @keyframes popUp {
            from {
              transform: scale(0.8);
              opacity: 0;
            }
            to {
              transform: scale(1);
              opacity: 1;
            }
          }
          .animate-popUp {
            animation: popUp 0.3s ease-out;
          }
        `}
      </style>
    </div>
  );
};

export default SadminDashboard;