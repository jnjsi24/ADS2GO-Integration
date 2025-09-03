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
        newErrors.contactNumber = "Please enter a valid Philippine phone number (e.g., +63 9123456789)";
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
    <div className="min-h-screen ml-64 bg-gray-100 pb-5 font-sans">
      {/* Main Content Area */}
      <div className="flex flex-col lg:flex-row pt-28 p-8 gap-8 max-w-7xl mx-auto">
        {/* Left Sidebar Card */}
        <aside className="w-full lg:w-1/3 bg-white h-auto rounded-3xl shadow-lg p-6 flex flex-col items-center">
          <div className="relative mb-6">
            <img
              src={formData.profilePicture}
              alt="Profile"
              className="w-32 h-32 mt-16 rounded-full object-cover border-4 border-[#1b5087]"
              // Fallback for image loading errors
              onError={(e) => {
                e.currentTarget.src = `https://placehold.co/100x100/3674B5/FFFFFF?text=${getInitials(formData.firstName, formData.lastName)}`;
              }}
            />
            {isEditing && (
              <label htmlFor="profile-picture-upload" className="absolute bottom-0 right-0 bg-[#1b5087] text-white rounded-full p-2 cursor-pointer hover:bg-[#1b5087] transition-colors">
                <Pencil size={16} />
                <input
                  id="profile-picture-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </label>
            )}
          </div>
          <p className="text-2xl font-semibold">{admin?.firstName} {admin?.lastName}</p>
          <button
            onClick={() => {
              // If not editing, enter edit mode, then trigger file input click
              if (!isEditing) {
                setIsEditing(true);
              }
              document.getElementById('profile-picture-upload')?.click();
            }}
            className="text-[#FF9D3D] mt-5 font-medium hover:underline mb-8"
          >
            Change
          </button>

          <div className="w-full bg-gray-50 rounded-lg p-4 text-center">
            <p className="text-sm font-semibold mb-2">Quote of the day</p>
            <p className="text-xs text-gray-600 italic">
              "Indulging in a scoop of happiness on a cone - because every day is a sundae when child's ice cream involved! 🍦💖 #ScoopsOfJoy #IceCreamLove"
            </p>
          </div>
        </aside>

        {/* Right Main Settings Card */}
        <section className="w-full lg:w-2/3 bg-white h-auto rounded-3xl shadow-lg p-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">Personal Settings</h2>
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center px-4 w-20 py-3 border border-white rounded-3xl bg-[#3674B5] text-white text-xs hover:bg-[#1b5087] transition-colors"
              >
                <div className="flex items-center space-x-2">
                  <Pencil size={16} />
                  <span>Edit</span>
                </div>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
            {/* First Name */}
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium text-gray-500 mb-1">First Name</label>
              <input
                id="firstName"
                name="firstName"
                type="text"
                autoComplete="given-name"
                value={formData.firstName}
                onChange={handleChange}
                disabled={!isEditing}
                className={`w-full py-2 border-b ${isEditing ? 'border-[#3674B5]' : 'border-gray-300'} focus:outline-none focus:border-[#3674B5] transition-colors bg-transparent`}
              />
              {isEditing && errors.firstName && <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>}
            </div>
            {/* Last Name */}
            <div>
              <label htmlFor="lastName" className="block text-sm font-medium text-gray-500 mb-1">Last Name</label>
              <input
                id="lastName"
                name="lastName"
                type="text"
                autoComplete="family-name"
                value={formData.lastName}
                onChange={handleChange}
                disabled={!isEditing}
                className={`w-full py-2 border-b ${isEditing ? 'border-[#3674B5]' : 'border-gray-300'} focus:outline-none focus:border-[#3674B5] transition-colors bg-transparent`}
              />
              {isEditing && errors.lastName && <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>}
            </div>
            {/* Phone Number */}
            <div>
              <label htmlFor="contactNumber" className="block text-sm font-medium text-gray-500 mb-1">Phone Number</label>
              <div className={`flex items-center py-2 border-b ${isEditing ? 'border-[#3674B5]' : 'border-gray-300'} focus-within:border-[#3674B5] transition-colors`}>
                <span className="text-gray-700 select-none pr-1">+63</span>
                <input
                  id="contactNumber"
                  name="contactNumber"
                  type="tel"
                  autoComplete="tel-national"
                  value={formData.contactNumber.replace('+63 ', '')}
                  onChange={handleChange}
                  disabled={!isEditing}
                  maxLength={10}
                  className="flex-grow focus:outline-none bg-transparent"
                />
              </div>
              {isEditing && errors.contactNumber && <p className="text-red-500 text-xs mt-1">{errors.contactNumber}</p>}
            </div>
            {/* Email Address */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-500 mb-1">Email Address</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={formData.email}
                onChange={handleChange}
                disabled={!isEditing}
                className={`w-full py-2 border-b ${isEditing ? 'border-[#3674B5]' : 'border-gray-300'} focus:outline-none focus:border-[#3674B5] transition-colors bg-transparent`}
              />
              {isEditing && errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
            </div>
            {/* Company Name */}
            <div>
              <label htmlFor="companyName" className="block text-sm font-medium text-gray-500 mb-1">Company Name</label>
              <input
                id="companyName"
                name="companyName"
                type="text"
                autoComplete="organization"
                value={formData.companyName || ''}
                onChange={handleChange}
                disabled={!isEditing}
                className={`w-full py-2 border-b ${isEditing ? 'border-[#3674B5]' : 'border-gray-300'} focus:outline-none focus:border-[#3674B5] transition-colors bg-transparent`}
              />
            </div>
            {/* Company Address */}
            <div>
              <label htmlFor="companyAddress" className="block text-sm font-medium text-gray-500 mb-1">Company Address</label>
              <input
                id="companyAddress"
                name="companyAddress"
                type="text"
                autoComplete="organization-street-address"
                value={formData.companyAddress || ''}
                onChange={handleChange}
                disabled={!isEditing}
                className={`w-full py-2 border-b ${isEditing ? 'border-[#3674B5]' : 'border-gray-300'} focus:outline-none focus:border-[#3674B5] transition-colors bg-transparent`}
              />
            </div>
            {/* City */}
            <div>
              <label htmlFor="city" className="block text-sm font-medium text-gray-500 mb-1">City</label>
              <input
                id="city"
                name="city"
                type="text"
                autoComplete="address-level2"
                value={formData.city}
                onChange={handleChange}
                disabled={!isEditing}
                className={`w-full py-2 border-b ${isEditing ? 'border-[#3674B5]' : 'border-gray-300'} focus:outline-none focus:border-[#3674B5] transition-colors bg-transparent`}
              />
            </div>
            {/* State */}
            <div>
              <label htmlFor="state" className="block text-sm font-medium text-gray-500 mb-1">State</label>
              <input
                id="state"
                name="state"
                type="text"
                autoComplete="address-level1"
                value={formData.state}
                onChange={handleChange}
                disabled={!isEditing}
                className={`w-full py-2 border-b ${isEditing ? 'border-[#3674B5]' : 'border-gray-300'} focus:outline-none focus:border-[#3674B5] transition-colors bg-transparent`}
              />
            </div>
            {/* Postal Code */}
            <div>
              <label htmlFor="postalCode" className="block text-sm font-medium text-gray-500 mb-1">Postal Code</label>
              <input
                id="postalCode"
                name="postalCode"
                type="text"
                autoComplete="postal-code"
                value={formData.postalCode}
                onChange={handleChange}
                disabled={!isEditing}
                className={`w-full py-2 border-b ${isEditing ? 'border-[#3674B5]' : 'border-gray-300'} focus:outline-none focus:border-[#3674B5] transition-colors bg-transparent`}
              />
            </div>
            {/* Country */}
            <div>
              <label htmlFor="country" className="block text-sm font-medium text-gray-500 mb-1">Country</label>
              <input
                id="country"
                name="country"
                type="text"
                autoComplete="country"
                value={formData.country}
                onChange={handleChange}
                disabled={!isEditing}
                className={`w-full py-2 border-b ${isEditing ? 'border-[#3674B5]' : 'border-gray-300'} focus:outline-none focus:border-[#3674B5] transition-colors bg-transparent`}
              />
            </div>
          </div>

          {isEditing && (
            <div className="mt-8 text-right flex justify-end space-x-4">
              <button
                onClick={handleCancel}
                className="text-gray-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdate}
                disabled={isSubmitting}
                className="bg-[#3674B5] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[#1b5087] transition-colors shadow-md disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Updating...' : 'Update'}
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default Account;
