import React, { useState, useEffect, ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Pencil, FileUp, Trash2 } from "lucide-react";
import { useUserAuth } from "../../contexts/UserAuthContext";
import { gql, useMutation } from "@apollo/client";
import { uploadUserProfilePicture } from "../../utils/fileUpload";

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
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

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

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
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
      setErrorMessage("Unsupported file type. Allowed types: JPG, JPEG, PNG");
      setSuccessMessage("");
      return;
    }

    try {
      // Upload the file to Firebase Storage
      const uploadedUrl = await uploadUserProfilePicture(file);
      setFormData(prev => ({ ...prev, profilePicture: uploadedUrl }));
      setSuccessMessage("Profile picture uploaded successfully!");
      setErrorMessage("");
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      setErrorMessage('Error uploading profile picture. Please try again.');
      setSuccessMessage("");
    }
  }
};

  const toggleEdit = async () => {
    if (isEditing) {
      setErrorMessage("");
      setSuccessMessage("");
      
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
          setSuccessMessage("Profile updated successfully!");
          setErrorMessage("");

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
          setErrorMessage(data.updateUser.message || "Update failed. Please try again.");
          setSuccessMessage("");
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
        
        setErrorMessage(errorMsg);
        setSuccessMessage("");
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
        setSuccessMessage(data.deleteOwnAccount.message || "Your account has been scheduled for deletion in 30 days.");
        setErrorMessage("");
        
        // Close modal first
        setShowDeleteModal(false);
        
        // Wait a moment for user to see success message, then logout
        setTimeout(() => {
          logout();
          navigate("/login");
        }, 2000);
      } else {
        setErrorMessage(data.deleteOwnAccount.message || "Failed to delete account. Please try again.");
        setSuccessMessage("");
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
      
      setErrorMessage(errorMsg);
      setSuccessMessage("");
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
    className="absolute inset-0 bg-cover bg-center bg-fixed blur-sm brightness-90"
    style={{
      backgroundImage: "url('/image/bg2.jpg')",
    }}
  ></div>

  {/* Overlay with gradient tint */}
  <div className="absolute inset-0 bg-white/40 backdrop-blur-xl"></div>

  {/* Main Content */}
  <div className="relative z-10 w-full flex items-center justify-center min-h-screen bg-transparent py-20 lg:py-10">
    <div className="rounded-xl shadow-2xl flex flex-col lg:flex-row w-full max-w-5xl overflow-hidden min-h-[600px] bg-white/20 backdrop-blur-md">
      {/* Left Section: Profile Card */}
        <div className="flex flex-col items-center justify-center p-6 sm:p-8 bg-white/10 bg-opacity-70 lg:w-1/3">
          <div className="relative w-36 h-36 rounded-full overflow-hidden mb-4 flex items-center justify-center bg-gray-400 text-black text-3xl font-bold">
            {formData.profilePicture ? (
              <img
                src={formData.profilePicture}
                alt="Profile"
                className="object-cover w-full h-full"
              />
            ) : (
              <span>
                {`${formData.firstName?.[0] || ""}${formData.lastName?.[0] || ""}`.toUpperCase()}
              </span>
            )}

            {/* Edit/upload button overlay */}
            {isEditing && (
              <label className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/50 opacity-80 cursor-pointer transition-all">
                <input
                  type="file"
                  accept="image/png, image/jpeg" // restrict selectable files
                  className="hidden"
                  onChange={handleImageChange}
                />
                <Pencil size={24} className="text-black" />
              </label>
            )}
        </div>
          <h2 className="text-xl font-semibold text-black mb-1">
            {formData.firstName} {formData.lastName}
          </h2>
          <p className="text-sm text-black/70 mb-6">{formData.email}</p>

          {!isEditing ? (
            // Edit Button & Delete Account Button
            <div className="flex flex-col gap-3 w-full px-4">
              <button
                onClick={() => setIsEditing(true)}
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = ((e.clientX - rect.left) / rect.width) * 100;
                  const y = ((e.clientY - rect.top) / rect.height) * 100;
                  setPos({ x, y });
                }}
                className="relative group inline-flex items-center justify-center overflow-hidden px-6 py-2 text-sm font-medium text-black/70 transition-all duration-300 hover:scale-105 rounded-md"
                style={{
                  backgroundImage: `linear-gradient(to right, #FFB877 0%, #FF9B45 100%), radial-gradient(circle at ${pos.x}% ${pos.y}%, rgba(173,216,230,0), rgba(173,216,230,0))`,
                }}
              >
                <span className="inline-flex items-center gap-2">
                  <Pencil size={16} />
                  Edit
                </span>
                <span
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                  style={{
                    background: `radial-gradient(circle at ${pos.x}% ${pos.y}%, rgba(255,255,255,0.25), transparent 60%)`,
                  }}
                />
              </button>

              {/* Delete Account Button */}
              <button
                onClick={handleDeleteAccount}
                className="relative group inline-flex items-center justify-center overflow-hidden px-6 py-2 text-sm font-medium text-white transition-all duration-300 hover:scale-105 rounded-md bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700"
              >
                <span className="inline-flex items-center gap-2">
                  <Trash2 size={16} />
                  Delete Account
                </span>
              </button>
            </div>
          ) : (
            // Save & Cancel Buttons
            <div className="flex gap-4">
              <button
                onClick={() => {
                  handleCancel();
                }}
                className=" hover:text-red-400 text-red-300 font-bold py-2 px-6 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={toggleEdit} // Save action
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = ((e.clientX - rect.left) / rect.width) * 100;
                  const y = ((e.clientY - rect.top) / rect.height) * 100;
                  setPos({ x, y });
                }}
                className="relative group inline-flex items-center justify-center overflow-hidden px-6 py-2 text-sm font-medium text-black/70 transition-all duration-300 hover:scale-105 rounded-md"
                style={{
                backgroundImage: `linear-gradient(to right, #FFB877 0%, #FF9B45 100%), radial-gradient(circle at ${pos.x}% ${pos.y}%, rgba(173,216,230,0), rgba(173,216,230,0))`,
                }}
              >
                <span className="inline-flex items-center gap-2">
                  Save
                </span>
                <span
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                  style={{
                    background: `radial-gradient(circle at ${pos.x}% ${pos.y}%, rgba(255,255,255,0.25), transparent 60%)`,
                  }}
                />
              </button>
            </div>
          )}
        </div>


        {/* Right Section */}
        <div className="flex-grow p-6 sm:p-8 space-y-6 sm:space-y-8 relative">
          {/* Error Message */}
          {errorMessage && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
              <span className="block sm:inline">{errorMessage}</span>
              <button
                className="absolute top-0 bottom-0 right-0 px-4 py-3"
                onClick={() => setErrorMessage("")}
              >
                <span className="text-xl">&times;</span>
              </button>
            </div>
          )}

          {/* Success Message */}
          {successMessage && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4">
              <span className="block sm:inline">{successMessage}</span>
              <button
                className="absolute top-0 bottom-0 right-0 px-4 py-3"
                onClick={() => setSuccessMessage("")}
              >
                <span className="text-xl">&times;</span>
              </button>
            </div>
          )}

          <h3 className="text-base sm:text-lg font-bold text-black mb-4 sm:mb-6">Personal Information</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 sm:gap-x-8 gap-y-4 sm:gap-y-6">
            {/* First Name & Middle Name */}
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

            {/* Last Name Full Width */}
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
              {/* Empty space to align with Middle Name */}
              <div className="flex-1 hidden sm:block"></div>
            </div>

            {/* Contact Number & Email */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 col-span-1 sm:col-span-2">
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

            {/* House Address Full Width */}
            <div className="col-span-2 space-y-1">
              <label className="block text-sm font-medium text-black/80">House Address</label>
              <input
                type="text"
                name="houseAddress"
                value={formData.houseAddress}
                onChange={handleInputChange}
                disabled={!isEditing}
                className="w-full border-b border-black/60 focus:outline-none focus:border-blue-500 text-black py-1 bg-transparent"
              />
            </div>
          </div>


          <h3 className="text-lg font-bold text-black mb-6">Company Information</h3>
          <div className="space-y-6">
            {["companyName", "companyAddress"].map((field) => (
              <div key={field} className="space-y-1">
                <label className="block text-sm font-medium text-black/80 capitalize">
                  {field.replace(/([A-Z])/g, ' $1')}
                </label>
                <input
                  type="text"
                  name={field}
                  value={(formData as any)[field]}
                  onChange={handleInputChange}
                  disabled={true} // Always read-only
                  className="w-full border-b border-black/60 focus:outline-none focus:border-blue-500 text-black py-1 bg-transparent"
                />
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>

    {/* Delete Account Confirmation Modal */}
    {showDeleteModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-white rounded-lg shadow-2xl p-6 sm:p-8 max-w-md w-full mx-4 relative">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
              <Trash2 className="h-6 w-6 text-red-600" />
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">
              Delete Account
            </h3>
            <p className="text-sm sm:text-base text-gray-600 mb-6">
              Are you sure you want to delete your account? Your account will be scheduled for permanent deletion in <span className="font-bold text-red-600">30 days</span>.
              <br /><br />
              During this period, you won't be able to access your account. After 30 days, all your data will be permanently deleted.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={cancelDelete}
                className="px-6 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteAccount}
                className="px-6 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors"
              >
                Yes, Delete My Account
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
