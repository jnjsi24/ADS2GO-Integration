
import React, { useState, useEffect, ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Pencil } from "lucide-react";
import { BellIcon } from '@heroicons/react/24/outline'; // This import is not used in the provided code.
import { useAuth } from '../../contexts/AuthContext'; // Assuming this context provides user data and a setter.

// Define the structure for user data from useAuth
interface UserData {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  companyName?: string;
  companyAddress?: string;
  contactNumber?: string;
  profilePicture?: string;
  email?: string;
  houseAddress?: string; // Mapped to 'city' in formData
  postalCode?: string;
  taxId?: string; // Not used in formData, but kept for completeness if needed elsewhere
}

interface FormData {
  firstName: string;
  middleName?: string;
  lastName: string;
  companyName?: string;
  companyAddress?: string;
  contactNumber: string; // This will store the full number, e.g., "+63 1234567890"
  profilePicture?: string;
  email: string;
  city: string; // Mapped from user.houseAddress
  state: string;
  postalCode: string;
  country: string;
}

const Account: React.FC = () => {
  const [isEditing, setIsEditing] = useState(false);
  const navigate = useNavigate(); // This hook is not used in the provided code.
  // Cast to include setUser as it's used later for updating user context
  const { user, setUser } = useAuth() as { user: UserData | null; setUser: (user: UserData | null) => void };

  // Helper to get initials for placeholder image text
  const getInitials = (firstName?: string, lastName?: string) => {
    if (!firstName && !lastName) return '?';
    const initials = `${firstName?.[0] || ''}${lastName?.[0] || ''}`;
    return initials.toUpperCase();
  };

  const [formData, setFormData] = useState<FormData>({
    firstName: "",
    middleName: "",
    lastName: "",
    companyName: "",
    companyAddress: "",
    contactNumber: "+63 ", // Initialize with static prefix
    email: "",
    profilePicture: "",
    city: "",
    state: "",
    postalCode: "",
    country: "United States",
  });

  const [errors, setErrors] = useState<{ [key: string]: string }>({
    firstName: "",
    lastName: "",
    contactNumber: "",
    email: "",
  });

  // Populate form with user data from AuthContext
  useEffect(() => {
    if (user) {
      // Ensure contactNumber is initialized correctly with the prefix and digits
      const initialContactNumber = user.contactNumber && user.contactNumber.startsWith("+63 ")
        ? user.contactNumber
        : (user.contactNumber ? `+63 ${user.contactNumber.replace(/\D/g, '').slice(0, 10)}` : "+63 ");

      setFormData({
        firstName: user.firstName || "",
        middleName: user.middleName || "",
        lastName: user.lastName || "",
        companyName: user.companyName || "",
        companyAddress: user.companyAddress || "",
        contactNumber: initialContactNumber,
        email: user.email || "",
        profilePicture: user.profilePicture || `https://placehold.co/100x100/3674B5/FFFFFF?text=${getInitials(user.firstName, user.lastName)}`,
        city: user.houseAddress || "", // Assuming houseAddress from user maps to city in form
        state: "New York", // Default value, as it's not in UserData
        postalCode: user.postalCode || "",
        country: "United States", // Default value, as it's not in UserData
      });
      // Reset errors when user data loads
      setErrors({
        firstName: "",
        lastName: "",
        contactNumber: "",
        email: "",
      });
    }
  }, [user]);

  const validateForm = (): boolean => {
    let isValid = true;
    const newErrors: { [key: string]: string } = { firstName: "", lastName: "", contactNumber: "", email: "" };

    // Validate First Name (only letters and spaces)
    const nameRegex = /^[A-Za-z\s]+$/;
    if (!formData.firstName.trim() || !nameRegex.test(formData.firstName)) {
      newErrors.firstName = "First Name should not contain numbers or symbols and cannot be empty.";
      isValid = false;
    }

    // Validate Last Name (only letters and spaces)
    if (!formData.lastName.trim() || !nameRegex.test(formData.lastName)) {
      newErrors.lastName = "Last Name should not contain numbers or symbols and cannot be empty.";
      isValid = false;
    }

    // Validate Phone Number (starts with +63 and followed by exactly 10 digits)
    // The regex expects the full string including "+63 "
    const phoneRegex = /^\+63\s?\d{10}$/; // Added \s? to allow for an optional space after +63
    if (!phoneRegex.test(formData.contactNumber)) {
      newErrors.contactNumber = "Please provide a valid phone number.";
      isValid = false;
    }

    // Validate Email (basic email format)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim() || !emailRegex.test(formData.email)) {
      newErrors.email = "Please enter a valid email address.";
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      let updatedValue = value;

      if (name === "contactNumber") {
        // Extract only digits from the input value (which is just the digits part)
        const digitsOnly = value.replace(/\D/g, ''); // Remove non-digits
        // Limit to 10 digits
        const limitedDigits = digitsOnly.slice(0, 10);
        // Construct the full phone number with the static prefix "+63 "
        updatedValue = `+63 ${limitedDigits}`;
      }

      return { ...prev, [name]: updatedValue };
    });

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = () => {
        setFormData((prev) => ({
          ...prev,
          profilePicture: reader.result as string,
        }));
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleUpdate = () => {
    if (user && setUser) {
      if (validateForm()) {
        // Update the user object in AuthContext with new data
        const updatedUser: UserData = {
          ...user,
          firstName: formData.firstName,
          lastName: formData.lastName,
          contactNumber: formData.contactNumber,
          email: formData.email,
          profilePicture: formData.profilePicture,
          houseAddress: formData.city, // Map form city back to user houseAddress
          postalCode: formData.postalCode,
          // Note: companyName, companyAddress, middleName, taxId are not updated here
          // as they are not part of the form fields that are explicitly handled for update.
        };
        setUser(updatedUser); // This will trigger a re-render with updated user data

        // Optional: Simulate saving to backend
        console.log("Saving profile data to backend:", updatedUser);
        // Example API call: await updateUserMutation({ variables: { ...updatedUser } });

        setIsEditing(false); // Exit editing mode
      }
    }
  };

  const handleCancel = () => {
    // Reset form data to current user data if available
    if (user) {
      const initialContactNumber = user.contactNumber && user.contactNumber.startsWith("+63 ")
        ? user.contactNumber
        : (user.contactNumber ? `+63 ${user.contactNumber.replace(/\D/g, '').slice(0, 10)}` : "+63 ");

      setFormData({
        firstName: user.firstName || "",
        middleName: user.middleName || "",
        lastName: user.lastName || "",
        companyName: user.companyName || "",
        companyAddress: user.companyAddress || "",
        contactNumber: initialContactNumber,
        email: user.email || "",
        profilePicture: user.profilePicture || `https://placehold.co/100x100/F3A26D/FFFFFF?text=${getInitials(user.firstName, user.lastName)}`,
        city: user.houseAddress || "",
        state: "New York",
        postalCode: user.postalCode || "",
        country: "United States",
      });
    }
    setErrors({
      firstName: "",
      lastName: "",
      contactNumber: "",
      email: "",
    });
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
          <p className="text-2xl font-semibold">{user?.firstName} {user?.lastName}</p>
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
                value={formData.firstName}
                onChange={handleInputChange}
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
                value={formData.lastName}
                onChange={handleInputChange}
                disabled={!isEditing}
                className={`w-full py-2 border-b ${isEditing ? 'border-[#3674B5]' : 'border-gray-300'} focus:outline-none focus:border-[#3674B5] transition-colors bg-transparent`}
              />
              {isEditing && errors.lastName && <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>}
            </div>
            {/* Phone Number - Modified to have static +63 */}
            <div>
              <label htmlFor="contactNumber" className="block text-sm font-medium text-gray-500 mb-1">Phone Number</label>
              <div className={`flex items-center py-2 border-b ${isEditing ? 'border-[#3674B5]' : 'border-gray-300'} focus-within:border-[#3674B5] transition-colors`}>
                <span className="text-gray-700 select-none pr-1">+63</span>
                <input
                  id="contactNumber"
                  name="contactNumber"
                  type="tel" // Use type="tel" for better mobile keyboard
                  // Display only the digits part by removing the static prefix
                  value={formData.contactNumber.replace('+63 ', '')}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  maxLength={10} // Limit the input field to 10 characters (digits)
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
                value={formData.email}
                onChange={handleInputChange}
                disabled={!isEditing}
                className={`w-full py-2 border-b ${isEditing ? 'border-[#3674B5]' : 'border-gray-300'} focus:outline-none focus:border-[#3674B5] transition-colors bg-transparent`}
              />
              {isEditing && errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
            </div>
            {/* City */}
            <div>
              <label htmlFor="city" className="block text-sm font-medium text-gray-500 mb-1">City</label>
              <input
                id="city"
                name="city"
                type="text"
                value={formData.city}
                onChange={handleInputChange}
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
                value={formData.state}
                onChange={handleInputChange}
                disabled={!isEditing}
                className={`w-full py-2 border-b ${isEditing ? 'border-[#3674B5]' : 'border-gray-300'} focus:outline-none focus:border-[#3674B5] transition-colors bg-transparent`}
              />
            </div>
            {/* Postcode */}
            <div>
              <label htmlFor="postalCode" className="block text-sm font-medium text-gray-500 mb-1">Postcode</label>
              <input
                id="postalCode"
                name="postalCode"
                type="text"
                value={formData.postalCode}
                onChange={handleInputChange}
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
                value={formData.country}
                onChange={handleInputChange}
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
                // Disable update button if there are any errors
                disabled={Object.values(errors).some(error => error !== "")}
                className="bg-[#3674B5] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[#1b5087] transition-colors shadow-md disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Update
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default Account;
