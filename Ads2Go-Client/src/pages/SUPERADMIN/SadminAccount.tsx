import React, { useState, useEffect, ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Pencil } from "lucide-react";
import { BellIcon } from '@heroicons/react/24/outline';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { useMutation } from "@apollo/client";
import { toast } from 'sonner';
import { UPDATE_SUPER_ADMIN_DETAIL } from "../../graphql/superadmin";

// Define the structure for admin data from useAdminAuth
interface AdminData {
  userId: string;
  email: string;
  role: string;
  isEmailVerified: boolean;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  companyName?: string;
  companyAddress?: string;
  contactNumber?: string;
  profilePicture?: string;
  houseAddress?: string;
  postalCode?: string;
  taxId?: string;
}

interface FormData {
  firstName: string;
  middleName?: string;
  lastName: string;
  companyName?: string;
  companyAddress?: string;
  contactNumber: string;
  profilePicture?: string;
  email: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

const Account: React.FC = () => {
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const { admin, setAdmin } = useAdminAuth() as { admin: AdminData | null; setAdmin: (admin: AdminData | null) => void };
  
  const [formData, setFormData] = useState<FormData>({
    firstName: "",
    middleName: "",
    lastName: "",
    companyName: "",
    companyAddress: "",
    contactNumber: "+63 ",
    email: "",
    profilePicture: "",
    city: "",
    state: "",
    postalCode: "",
    country: "United States",
  });

  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // Helper to get initials for placeholder image text
  const getInitials = (firstName?: string, lastName?: string) => {
    if (!firstName && !lastName) return '?';
    const initials = `${firstName?.[0] || ''}${lastName?.[0] || ''}`;
    return initials.toUpperCase();
  };

  // Populate form with user data from AuthContext
  useEffect(() => {
    console.log('Admin object from AdminAuthContext:', admin);
    if (admin) {
      console.log('Admin ID:', admin.userId);
      const initialContactNumber = admin.contactNumber && admin.contactNumber.startsWith("+63 ")
        ? admin.contactNumber
        : (admin.contactNumber ? `+63 ${admin.contactNumber.replace(/\D/g, '').slice(0, 10)}` : "+63 ");

      setFormData({
        firstName: admin.firstName || "",
        middleName: admin.middleName || "",
        lastName: admin.lastName || "",
        companyName: admin.companyName || "",
        companyAddress: admin.companyAddress || "",
        contactNumber: initialContactNumber,
        email: admin.email || "",
        profilePicture: admin.profilePicture || `https://placehold.co/100x100/F3A26D/FFFFFF?text=${getInitials(admin.firstName, admin.lastName)}`,
        city: admin.houseAddress || "",
        state: "New York",
        postalCode: admin.postalCode || "",
        country: "United States",
      });
    }
  }, [admin]);

  useEffect(() => {
    console.log('Admin object updated:', admin);
    if (admin) {
      console.log('Admin ID in effect:', admin.userId);
      console.log('Admin keys:', Object.keys(admin));
    }
  }, [admin]);

  useEffect(() => {
    console.log('Form validation errors:', errors);
    console.log('Is form valid?', Object.keys(errors).length === 0);
  }, [errors]);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setFormData(prev => ({
            ...prev,
            profilePicture: event.target?.result as string
          }));
        }
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  // Add the mutation hook
  const [updateAdminDetails] = useMutation(UPDATE_SUPER_ADMIN_DETAIL, {
    onCompleted: (data) => {
      if (data.updateAdminDetails.success) {
        // Update the admin in the auth context
        if (admin) {
          setAdmin({
            ...admin,
            ...data.updateAdminDetails.user,
          });
        }
        toast.success("Profile updated successfully!");
        setIsEditing(false);
      } else {
        toast.error(data.updateAdminDetails.message || "Failed to update profile");
      }
      setIsSubmitting(false);
    },
    onError: (error) => {
      console.error("Error updating profile:", error);
      toast.error(error.message || "An error occurred while updating your profile");
      setIsSubmitting(false);
    },
  });

  const handleUpdate = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault(); // Prevent default form submission
    console.log('Update button clicked');
    
    if (!admin?.userId) {
      console.error('Admin ID is missing');
      toast.error("Admin ID is missing. Please try again.");
      return;
    }
    
    console.log('Validating form...');
    const isValid = validateForm();
    console.log('Form validation result:', isValid);
    console.log('Current errors:', errors);
    
    if (isValid) {
      console.log('Form is valid, preparing to submit...');
      setIsSubmitting(true);
      
      try {
        // Prepare the input object with only the fields that have values
        const input: any = {};
        
        // Only include fields that have values
        if (formData.firstName) input.firstName = formData.firstName;
        if (formData.middleName) input.middleName = formData.middleName;
        if (formData.lastName) input.lastName = formData.lastName;
        if (formData.email) input.email = formData.email;
        if (formData.contactNumber && formData.contactNumber !== "+63 ") {
          input.contactNumber = formData.contactNumber;
        }
        if (formData.companyName) input.companyName = formData.companyName;
        if (formData.companyAddress) input.companyAddress = formData.companyAddress;
        
        console.log('Sending update request with:', { adminId: admin.userId, input });
        
        const { data } = await updateAdminDetails({
          variables: {
            adminId: admin.userId,
            input
          },
        });

        console.log('Update response:', data);

        if (data?.updateAdminDetails?.success) {
          console.log('Update successful, updating user context...');
          // Update the admin context with the new data
          setAdmin({
            ...admin,
            ...data.updateAdminDetails.user,
          });
          
          toast.success("Profile updated successfully!");
          setIsEditing(false);
        } else {
          console.error('Update failed:', data?.updateAdminDetails?.message);
          toast.error(data?.updateAdminDetails?.message || "Failed to update profile");
        }
      } catch (error) {
        console.error("Error in handleUpdate:", error);
        toast.error("An error occurred while updating your profile");
      } finally {
        console.log('Update process completed');
        setIsSubmitting(false);
      }
    } else {
      console.log('Form validation failed, not submitting');
    }
  };

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    // Email validation (only if provided)
    if (formData.email && formData.email.trim() !== '') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        newErrors.email = "Please enter a valid email address";
      }
    }

    // Phone number validation (only if provided and not just the default +63 )
    if (formData.contactNumber && formData.contactNumber !== "+63 " && formData.contactNumber.trim() !== '') {
      const phoneRegex = /^\+63\s?\d{10}$/;
      if (!phoneRegex.test(formData.contactNumber)) {
        newErrors.contactNumber = "Please enter a valid Philippine mobile number. Format: +639XXXXXXXXX (10 digits starting with 9)";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCancel = () => {
    // Reset form data to current admin data if available
    if (admin) {
      const initialContactNumber = admin.contactNumber && admin.contactNumber.startsWith("+63 ")
        ? admin.contactNumber
        : (admin.contactNumber ? `+63 ${admin.contactNumber.replace(/\D/g, '').slice(0, 10)}` : "+63 ");

      setFormData({
        firstName: admin.firstName || "",
        middleName: admin.middleName || "",
        lastName: admin.lastName || "",
        companyName: admin.companyName || "",
        companyAddress: admin.companyAddress || "",
        contactNumber: initialContactNumber,
        email: admin.email || "",
        profilePicture: admin.profilePicture || `https://placehold.co/100x100/F3A26D/FFFFFF?text=${getInitials(admin.firstName, admin.lastName)}`,
        city: admin.houseAddress || "",
        state: "New York",
        postalCode: admin.postalCode || "",
        country: "United States",
      });
    }
    setErrors({});
    setIsEditing(false);
  };

  return (
    <div
      className="min-h-screen pl-72 pr-5 flex items-center justify-center"
    >
      {/* Outer Card */}
      <div className="rounded-xl shadow-lg flex flex-col lg:flex-row w-full max-w-6xl overflow-hidden min-h-[650px]">
        {/* ==== LEFT PROFILE SECTION ==== */}
        <aside className="flex flex-col items-center justify-center p-8 bg-black/10 bg-opacity-70 lg:w-1/3">
          {/* Profile Picture */}
          <div className="relative w-36 h-36 rounded-full overflow-hidden mb-4 flex items-center justify-center bg-gray-400 text-white text-3xl font-bold">
            {formData.profilePicture ? (
              <img
                src={formData.profilePicture}
                alt="Profile"
                className="object-cover w-full h-full"
                onError={(e) => {
                  e.currentTarget.src = `https://placehold.co/100x100/3674B5/FFFFFF?text=${getInitials(
                    formData.firstName,
                    formData.lastName
                  )}`;
                }}
              />
            ) : (
              <span>
                {`${formData.firstName?.[0] || ""}${
                  formData.lastName?.[0] || ""
                }`.toUpperCase()}
              </span>
            )}
  
            {/* Upload button */}
            {isEditing && (
              <label className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/50 opacity-80 cursor-pointer transition-all">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageChange}
                />
                <Pencil size={24} className="text-white" />
              </label>
            )}
          </div>
  
          <h2 className="text-xl font-semibold mb-1">
            {formData.firstName} {formData.lastName}
          </h2>
          <p className="text-sm text-black/80 mb-6">{formData.email}</p>
  
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="px-6 py-2 text-sm font-medium bg-[#FF9B45] text-white/80 rounded-md hover:scale-105 transition-all"
            >
              <div className="inline-flex items-center gap-2 text-white/80">
                <Pencil size={16} />
                Edit
              </div>
            </button>
          ) : (
            <div className="flex gap-4">
              <button
                onClick={handleCancel}
                className="hover:text-red-400 text-red-300 font-bold py-2 px-6 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdate}
                disabled={isSubmitting}
                className="px-6 py-2 text-sm font-medium bg-[#FF9B45] text-white/80 rounded-md hover:scale-105 transition-all disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Updating..." : "Save"}
              </button>
            </div>
          )}
        </aside>
  
        {/* ==== RIGHT SETTINGS SECTION ==== */}
        <section className="flex-grow p-8 space-y-10 bg-white/20">
          <h2 className="text-2xl font-bold text-gray-800">Personal Settings</h2>
  
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
            {/* First / Last Name */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                First Name
              </label>
              <input
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                disabled={!isEditing}
                className={`w-full py-2 border-b ${
                  isEditing ? "border-[#3674B5]" : "border-gray-300"
                } focus:outline-none focus:border-[#3674B5] bg-transparent`}
              />
              {isEditing && errors.firstName && (
                <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Last Name
              </label>
              <input
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                disabled={!isEditing}
                className={`w-full py-2 border-b ${
                  isEditing ? "border-[#3674B5]" : "border-gray-300"
                } focus:outline-none focus:border-[#3674B5] bg-transparent`}
              />
              {isEditing && errors.lastName && (
                <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>
              )}
            </div>
  
            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Phone Number
              </label>
              <div
                className={`flex items-center py-2 border-b ${
                  isEditing ? "border-[#3674B5]" : "border-gray-300"
                } focus-within:border-[#3674B5]`}
              >
                <span className="text-gray-700 pr-1">+63</span>
                <input
                  name="contactNumber"
                  type="tel"
                  value={formData.contactNumber.replace("+63 ", "")}
                  onChange={handleChange}
                  disabled={!isEditing}
                  maxLength={10}
                  className="flex-grow focus:outline-none bg-transparent"
                />
              </div>
              {isEditing && errors.contactNumber && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.contactNumber}
                </p>
              )}
            </div>
  
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Email Address
              </label>
              <input
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                disabled={!isEditing}
                className={`w-full py-2 border-b ${
                  isEditing ? "border-[#3674B5]" : "border-gray-300"
                } focus:outline-none focus:border-[#3674B5] bg-transparent`}
              />
              {isEditing && errors.email && (
                <p className="text-red-500 text-xs mt-1">{errors.email}</p>
              )}
            </div>
  
            {/* Company Name */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Company Name
              </label>
              <input
                name="companyName"
                value={formData.companyName || ""}
                onChange={handleChange}
                disabled={!isEditing}
                className={`w-full py-2 border-b ${
                  isEditing ? "border-[#3674B5]" : "border-gray-300"
                } focus:outline-none focus:border-[#3674B5] bg-transparent`}
              />
            </div>
  
            {/* Company Address */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Company Address
              </label>
              <input
                name="companyAddress"
                value={formData.companyAddress || ""}
                onChange={handleChange}
                disabled={!isEditing}
                className={`w-full py-2 border-b ${
                  isEditing ? "border-[#3674B5]" : "border-gray-300"
                } focus:outline-none focus:border-[#3674B5] bg-transparent`}
              />
            </div>
  
            {/* City */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                City
              </label>
              <input
                name="city"
                value={formData.city}
                onChange={handleChange}
                disabled={!isEditing}
                className={`w-full py-2 border-b ${
                  isEditing ? "border-[#3674B5]" : "border-gray-300"
                } focus:outline-none focus:border-[#3674B5] bg-transparent`}
              />
            </div>
  
            {/* State */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                State
              </label>
              <input
                name="state"
                value={formData.state}
                onChange={handleChange}
                disabled={!isEditing}
                className={`w-full py-2 border-b ${
                  isEditing ? "border-[#3674B5]" : "border-gray-300"
                } focus:outline-none focus:border-[#3674B5] bg-transparent`}
              />
            </div>
  
            {/* Postal Code */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Postal Code
              </label>
              <input
                name="postalCode"
                value={formData.postalCode}
                onChange={handleChange}
                disabled={!isEditing}
                className={`w-full py-2 border-b ${
                  isEditing ? "border-[#3674B5]" : "border-gray-300"
                } focus:outline-none focus:border-[#3674B5] bg-transparent`}
              />
            </div>
  
            {/* Country */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Country
              </label>
              <input
                name="country"
                value={formData.country}
                onChange={handleChange}
                disabled={!isEditing}
                className={`w-full py-2 border-b ${
                  isEditing ? "border-[#3674B5]" : "border-gray-300"
                } focus:outline-none focus:border-[#3674B5] bg-transparent`}
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );  
};

export default Account;
