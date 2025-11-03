import React, { useState, useEffect, ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Pencil, Trash2, MoreVertical } from "lucide-react";
import { useUserAuth } from "../../contexts/UserAuthContext";
import { gql, useMutation } from "@apollo/client";
import { uploadUserProfilePicture } from "../../utils/fileUpload";
import { useToast, ToastContainer } from "../../components/ToastNotification";
import ConfirmationModal from "../../components/ConfirmationModal";
import { AnimatePresence, motion } from "framer-motion";

// GraphQL Mutation (update user)
const UPDATE_USER = gql`
  mutation UpdateUser($input: UpdateUserInput!) {
    updateUser(input: $input) {
      success
      message
      user {
        id
        firstName
        middleName
        lastName
        companyName
        companyAddress
        contactNumber
        email
        houseAddress
        profilePicture
      }
    }
  }
`;

// GraphQL Mutation (delete own account)
const DELETE_OWN_ACCOUNT = gql`
  mutation DeleteOwnAccount {
    deleteOwnAccount {
      success
      message
    }
  }
`;

interface FormData {
  firstName: string;
  middleName?: string;
  lastName: string;
  companyName: string;
  companyAddress: string;
  contactNumber: string;
  profilePicture?: string;
  email: string;
  houseAddress?: string;
}

const Account: React.FC = () => {
  const [isEditing, setIsEditing] = useState(false);
  const navigate = useNavigate();
  const { user, setUser, logout } = useUserAuth();
  const [pos, setPos] = useState({ x: 50, y: 50 }); // for hover shine
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const { toasts, addToast, removeToast } = useToast();

  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    firstName: "",
    middleName: "",
    lastName: "",
    companyName: "",
    companyAddress: "",
    contactNumber: "",
    email: "",
    profilePicture: "",
    houseAddress: "",
  });

  const [updateUser] = useMutation(UPDATE_USER);
  const [deleteOwnAccount] = useMutation(DELETE_OWN_ACCOUNT);

  useEffect(() => {
    if (user) {
      setFormData({
        firstName: user.firstName || "",
        middleName: user.middleName || "",
        lastName: user.lastName || "",
        companyName: user.companyName || "",
        companyAddress: user.companyAddress || "",
        contactNumber: user.contactNumber || "",
        email: user.email || "",
        profilePicture: user.profilePicture || "",
        houseAddress: user.houseAddress || "",
      });
    }
  }, [user]);

  useEffect(() => {
    const handleClickOutside = () => setShowMobileMenu(false);
    if (showMobileMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showMobileMenu]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleTextareaChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
};

  const handleCancel = () => {
  if (user) {
    setFormData({
      firstName: user.firstName || "",
      middleName: user.middleName || "",
      lastName: user.lastName || "",
      companyName: user.companyName || "",
      companyAddress: user.companyAddress || "",
      contactNumber: user.contactNumber || "",
      email: user.email || "",
      profilePicture: user.profilePicture || "",
      houseAddress: user.houseAddress || "",
    });
  }
  setIsEditing(false);
};

const handleImageChange = async (e: ChangeEvent<HTMLInputElement>) => {
  if (e.target.files && e.target.files[0]) {
    const file = e.target.files[0];
    const allowedExtensions = ["jpg", "jpeg", "png"];
    const extension = file.name.split(".").pop()?.toLowerCase();

    if (!extension || !allowedExtensions.includes(extension)) {
      addToast({
        type: 'error',
        title: 'Invalid File Type',
        message: 'Unsupported file type. Allowed types: JPG, JPEG, PNG',
        duration: 4000
      });
      return;
    }

    try {
      // Upload the file to Firebase Storage
      const uploadedUrl = await uploadUserProfilePicture(file);
      setFormData(prev => ({ ...prev, profilePicture: uploadedUrl }));
      addToast({
        type: 'success',
        title: 'Success!',
        message: 'Profile picture uploaded successfully',
        duration: 3000
      });
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      addToast({
        type: 'error',
        title: 'Upload Failed',
        message: 'Error uploading profile picture. Please try again.',
        duration: 4000
      });
    }
  }
};

  const toggleEdit = async () => {
    if (isEditing) {
      try {
        const { data } = await updateUser({
          variables: {
            input: {
              firstName: formData.firstName,
              middleName: formData.middleName,
              lastName: formData.lastName,
              companyName: formData.companyName,
              companyAddress: formData.companyAddress,
              contactNumber: formData.contactNumber,
              email: formData.email,
              houseAddress: formData.houseAddress,
              profilePicture: formData.profilePicture, // ✅ include picture
            },
          },
        });

        if (data.updateUser.success) {
          addToast({
            type: 'success',
            title: 'Success!',
            message: 'Profile updated successfully!',
            duration: 3000
          });

          // ✅ Update context AFTER save
          if (user) {
            setUser({
              ...user,
              firstName: formData.firstName,
              middleName: formData.middleName,
              lastName: formData.lastName,
              contactNumber: formData.contactNumber,
              houseAddress: formData.houseAddress,
              profilePicture: formData.profilePicture,
            });
          }
        } else {
          addToast({
            type: 'error',
            title: 'Update Failed',
            message: data.updateUser.message || 'Update failed. Please try again.',
            duration: 4000
          });
        }
      } catch (error: any) {
        // Extract specific error message
        let errorMsg = "Something went wrong. Please try again.";
        
        if (error?.graphQLErrors && error.graphQLErrors.length > 0) {
          errorMsg = error.graphQLErrors[0].message;
        } else if (error?.networkError?.result?.errors && error.networkError.result.errors.length > 0) {
          errorMsg = error.networkError.result.errors[0].message;
        } else if (error?.message) {
          errorMsg = error.message;
        }
        
        addToast({
          type: 'error',
          title: 'Error',
          message: errorMsg,
          duration: 5000
        });
      }
    }
    setIsEditing((prev) => !prev);
  };

  const handleDeleteAccount = () => {
    setShowDeleteModal(true);
  };

  const confirmDeleteAccount = async () => {
    try {
      const { data } = await deleteOwnAccount();

      if (data.deleteOwnAccount.success) {
        addToast({
          type: 'success',
          title: 'Account Deleted',
          message: data.deleteOwnAccount.message || "Your account has been scheduled for deletion in 30 days.",
          duration: 5000
        });
        
        // Close modal first
        setShowDeleteModal(false);
        
        // Wait a moment for user to see success message, then logout
        setTimeout(() => {
          logout();
          navigate("/login");
        }, 2000);
      } else {
        addToast({
          type: 'error',
          title: 'Delete Failed',
          message: data.deleteOwnAccount.message || "Failed to delete account. Please try again.",
          duration: 5000
        });
        setShowDeleteModal(false);
      }
    } catch (error: any) {
      // Extract specific error message
      let errorMsg = "Error deleting account. Please try again.";
      
      if (error?.graphQLErrors && error.graphQLErrors.length > 0) {
        errorMsg = error.graphQLErrors[0].message;
      } else if (error?.networkError?.result?.errors && error.networkError.result.errors.length > 0) {
        errorMsg = error.networkError.result.errors[0].message;
      } else if (error?.message) {
        errorMsg = error.message;
      }
      
      addToast({
        type: 'error',
        title: 'Error',
        message: errorMsg,
        duration: 5000
      });
    } finally {
      setShowDeleteModal(false);
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
  };


  return (
    <div className="relative min-h-screen overflow-hidden lg:pl-72 px-4 sm:px-5 lg:pr-5 flex items-center justify-center">
      {/* Background Image */}
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat blur-sm brightness-90"
        style={{ backgroundImage: "url('/image/bg2.jpg')" }}
      />
      <div className="fixed inset-0 bg-white/40 backdrop-blur-xl" />

      {/* Main Content */}
      <div className="relative z-10 w-full flex items-center justify-center min-h-screen bg-transparent py-20 lg:py-10">
        <div className="rounded-xl shadow-2xl flex flex-col lg:flex-row w-full max-w-5xl overflow-hidden min-h-[600px] bg-white/20 backdrop-blur-md">
          
          {/* ==================== LEFT SECTION: Profile Card ==================== */}
          <div className="flex flex-col items-center justify-center p-6 sm:p-8 bg-white/10 bg-opacity-70 lg:w-1/3">
            {/* Profile Picture */}
            <div className="relative w-36 h-36 rounded-full overflow-hidden mb-4 flex items-center justify-center bg-gray-400 text-black text-3xl font-bold">
              {formData.profilePicture ? (
                <img src={formData.profilePicture} alt="Profile" className="object-cover w-full h-full" />
              ) : (
                <span>{`${formData.firstName?.[0] || ''}${formData.lastName?.[0] || ''}`.toUpperCase()}</span>
              )}

              {isEditing && (
                <label className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/50 opacity-80 cursor-pointer transition-all">
                  <input
                    type="file"
                    accept="image/png, image/jpeg"
                    className="hidden"
                    onChange={handleImageChange}
                  />
                  <Pencil size={24} className="text-white" />
                </label>
              )}
            </div>

            <h2 className="text-xl font-semibold text-black mb-1">
              {formData.firstName} {formData.lastName}
            </h2>
            <p className="text-sm text-black/70 mb-6">{formData.email}</p>

            {/* Mobile 3-Dot Menu + Desktop Buttons */}
            <div className="w-full px-4 lg:px-0">
              {/* Desktop Buttons */}
              <div className="hidden lg:flex flex-col gap-3">
              {!isEditing ? (
  <div className="flex flex-col items-center justify-center gap-3 mt-4">
    {/* Edit Button */}
    <button
      onClick={() => setIsEditing(true)}
      className="inline-flex items-center gap-2 text-sm font-medium text-black/60 hover:text-black"
    >
      <Pencil size={16} />
      Edit
    </button>

    {/* Delete Button */}
    <button
      onClick={handleDeleteAccount}
      className="inline-flex items-center gap-2 justify-center px-6 py-2 w-40 text-xs font-medium text-white bg-red-500 rounded-md hover:bg-red-600 hover:shadow-md"
    >
      <Trash2 size={14} />
      Delete Account
    </button>
  </div>
) : (
  <div className="flex items-center justify-center gap-4 mt-4">
    {/* Cancel Button */}
    <button
      onClick={handleCancel}
      className="text-black/60 hover:text-black font-medium py-2 px-6 rounded-md transition-colors"
    >
      Cancel
    </button>

    {/* Save Button */}
    <button
      onClick={toggleEdit}
      className="bg-[#3674B5] text-white font-medium py-2 px-6 rounded-md hover:bg-[#2f639a] hover:shadow-md"
    >
      Save
    </button>
  </div>
)}

              </div>

              {/* Mobile 3-Dot Menu - Aligned with Profile Circle, Upper Right */}
              <div className="absolute top-6 right-6 lg:hidden z-10">
              {!isEditing ? (
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMobileMenu((prev) => !prev);
                    }}
                    className="p-2 rounded-full hover:bg-white/30 transition-all duration-200 shadow-sm bg-white/20 backdrop-blur-sm"
                    aria-label="More options"
                  >
                    <MoreVertical size={20} className="text-black" />
                  </button>

                  {/* Dropdown Menu with Animation */}
                  <AnimatePresence>
                    {showMobileMenu && (
                      <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="absolute -right-6 mt-0.5 w-36 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden z-50"
                      >
                        <button
                          onClick={() => {
                            setIsEditing(true);
                            setShowMobileMenu(false);
                          }}
                          className="w-full text-left px-4 py-3 text-xs text-gray-800 hover:bg-gray-50 flex items-center gap-2 transition-colors"
                        >
                          <Pencil size={16} />
                          Edit Profile
                        </button>
                        <button
                          onClick={() => {
                            handleDeleteAccount();
                            setShowMobileMenu(false);
                          }}
                          className="w-full text-left px-4 py-3 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                        >
                          <Trash2 size={16} />
                          Delete Account
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                  /* Save/Cancel buttons when editing */
                  <div className="flex gap-2 w-full mt-4">
                    <button
                      onClick={handleCancel}
                      className="flex-1 text-red-300 hover:text-red-400 font-medium py-2 px-4 rounded-md text-sm transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={toggleEdit}
                      className="flex-1 bg-gradient-to-r from-orange-400 to-orange-500 text-black/80 font-medium py-2 px-4 rounded-md text-sm hover:scale-105 transition-transform"
                    >
                      Save
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ==================== RIGHT SECTION: Form ==================== */}
          <div className="flex-grow p-6 sm:p-8 space-y-6 sm:space-y-8">
            <h3 className="text-base sm:text-lg font-bold text-black mb-4 sm:mb-6">Personal Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 sm:gap-x-8 gap-y-4 sm:gap-y-6">
              {/* First & Middle Name */}
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 col-span-1 sm:col-span-2">
                <div className="flex-1 space-y-1">
                  <label className="block text-sm font-medium text-black/80">First Name</label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                    className="w-full border-b border-black/60 focus:outline-none focus:border-blue-500 text-black py-1 bg-transparent"
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <label className="block text-sm font-medium text-black/80">Middle Name</label>
                  <input
                    type="text"
                    name="middleName"
                    value={formData.middleName}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                    className="w-full border-b border-black/60 focus:outline-none focus:border-blue-500 text-black py-1 bg-transparent"
                  />
                </div>
              </div>

              {/* Last Name */}
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 col-span-1 sm:col-span-2">
                <div className="flex-1 space-y-1">
                  <label className="block text-sm font-medium text-black/80">Last Name</label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                    className="w-full border-b border-black/60 focus:outline-none focus:border-blue-500 text-black py-1 bg-transparent"
                  />
                </div>
                <div className="flex-1 hidden sm:block"></div>
              </div>

              {/* Contact & Email */}
              <div className="flex sm:flex-row gap-3 sm:gap-4 col-span-2 sm:col-span-2">
                <div className="flex-1 space-y-1">
                  <label className="block text-sm font-medium text-black/80">Contact Number</label>
                  <input
                    type="text"
                    name="contactNumber"
                    value={formData.contactNumber}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                    className="w-full border-b border-black/60 focus:outline-none focus:border-blue-500 text-black py-1 bg-transparent"
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <label className="block text-sm font-medium text-black/80">Email Address</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    disabled
                    className="w-full border-b border-black/60 focus:outline-none focus:border-blue-500 text-black py-1 bg-transparent"
                  />
                </div>
              </div>

              {/* House Address - Responsive */}
              <div className="col-span-2 space-y-1">
                <label className="block text-sm font-medium text-black/80">House Address</label>
                
                {/* Show textarea on mobile, input on desktop */}
                <textarea
                  name="houseAddress"
                  value={formData.houseAddress}
                  onChange={handleTextareaChange}
                  disabled={!isEditing}
                  rows={2}
                  className="w-full border-b border-black/60 focus:outline-none focus:border-blue-500 text-black py-1 bg-transparent resize-y min-h-[60px] md:hidden"
                />
                
                <input
                  type="text"
                  name="houseAddress"
                  value={formData.houseAddress}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  className="w-full border-b border-black/60 focus:outline-none focus:border-blue-500 text-black py-1 bg-transparent hidden md:block"
                />
              </div>
            </div>

            <h3 className="text-base sm:text-lg font-bold text-black mb-4 sm:mb-6">Company Information</h3>
            <div className="space-y-6">
              {["companyName", "companyAddress"].map((field) => (
                <div key={field} className="space-y-1">
                  <label className="block text-sm font-medium text-black/80 capitalize">
                    {field.replace(/([A-Z])/g, ' $1').trim()}
                  </label>
                  <input
                    type="text"
                    name={field}
                    value={(formData as any)[field]}
                    onChange={handleInputChange}
                    disabled
                    className="w-full border-b border-black/60 text-black py-1 bg-transparent"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-md p-6 sm:p-8 max-w-md w-full mx-4">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">Delete Account</h3>
              <p className="text-sm sm:text-base text-gray-600 mb-6">
                Are you sure? Your account will be scheduled for deletion in <span className="font-bold text-red-600">30 days</span>.
                <br /><br />
                You won't be able to access it during this time.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={cancelDelete}
                  className="px-6 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteAccount}
                  className="px-6 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
                >
                  Yes, Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Account;