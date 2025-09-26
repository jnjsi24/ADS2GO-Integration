import React, { useState, useEffect, ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Pencil, FileUp } from "lucide-react";
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
  const { user, setUser} = useUserAuth();
  const [pos, setPos] = useState({ x: 50, y: 50 }); // for hover shine

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
      alert("Unsupported file type. Allowed types: JPG, JPEG, PNG");
      return;
    }

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("File size too large. Maximum size is 5MB");
      return;
    }

    try {
      // Show loading state
      setFormData(prev => ({ ...prev, profilePicture: "uploading..." }));
      
      // Upload to Firebase
      const downloadURL = await uploadUserProfilePicture(file);
      
      // Update form data with Firebase URL
      setFormData(prev => ({ ...prev, profilePicture: downloadURL }));
    } catch (error) {
      console.error("Error uploading profile picture:", error);
      alert("Failed to upload profile picture. Please try again.");
      // Reset to previous value on error
      setFormData(prev => ({ ...prev, profilePicture: user?.profilePicture || "" }));
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
          alert("Profile updated successfully!");

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
          alert("Update failed: " + data.updateUser.message);
        }
      } catch (error: any) {
        alert("Something went wrong: " + error.message);
      }
    }
    setIsEditing((prev) => !prev);
  };


  return (
<div
      className="min-h-screen pl-72 pr-5 p-10 bg-cover bg-center bg-no-repeat flex items-center justify-center"
      style={{
        backgroundImage: "linear-gradient(135deg, #3674B5 0%, black 100%)",
      }}
    >      <div className="rounded-xl shadow-2xl flex flex-col sm:flex-row w-full max-w-5xl overflow-hidden min-h-[600px]">
        {/* Left Section: Profile Card */}
        <div className="flex flex-col items-center justify-center p-8 bg-white/10 bg-opacity-70 sm:w-1/3">
          <div className="relative w-36 h-36 rounded-full overflow-hidden mb-4 flex items-center justify-center bg-gray-400 text-white text-3xl font-bold">
            {formData.profilePicture && formData.profilePicture !== "uploading..." ? (
              <img
                src={formData.profilePicture}
                alt="Profile"
                className="object-cover w-full h-full"
                onError={(e) => {
                  // Fallback to initials if image fails to load
                  e.currentTarget.style.display = 'none';
                  const nextElement = e.currentTarget.nextElementSibling as HTMLElement;
                  if (nextElement) {
                    nextElement.style.display = 'flex';
                  }
                }}
              />
            ) : null}
            {(!formData.profilePicture || formData.profilePicture === "uploading...") && (
              <span className={formData.profilePicture === "uploading..." ? "text-blue-300" : ""}>
                {formData.profilePicture === "uploading..." ? "Uploading..." : `${formData.firstName?.[0] || ""}${formData.lastName?.[0] || ""}`.toUpperCase()}
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
                <Pencil size={24} className="text-white" />
              </label>
            )}
        </div>
          <h2 className="text-xl font-semibold text-white mb-1">
            {formData.firstName} {formData.lastName}
          </h2>
          <p className="text-sm text-white/70 mb-6">{formData.email}</p>

          {!isEditing ? (
            // Edit Button
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
        <div className="flex-grow p-8 space-y-8 relative">
          <h3 className="text-lg font-bold text-white mb-6">Personal Information</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
            {/* First Name & Middle Name */}
            <div className="flex gap-4 col-span-2 sm:col-span-2">
              <div className="flex-1 space-y-1">
                <label className="block text-sm font-medium text-white/80">First Name</label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  className="w-full border-b border-gray-300 focus:outline-none focus:border-blue-500 text-white py-1 bg-transparent"
                />
              </div>
              <div className="flex-1 space-y-1">
                <label className="block text-sm font-medium text-white/80">Middle Name</label>
                <input
                  type="text"
                  name="middleName"
                  value={formData.middleName}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  className="w-full border-b border-gray-300 focus:outline-none focus:border-blue-500 text-white py-1 bg-transparent"
                />
              </div>
            </div>

            {/* Last Name Full Width */}
            <div className="flex gap-4 col-span-2 sm:col-span-2">
              <div className="flex-1 space-y-1">
                <label className="block text-sm font-medium text-white/80">Last Name</label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  className="w-full border-b border-gray-300 focus:outline-none focus:border-blue-500 text-white py-1 bg-transparent"
                />
              </div>
              {/* Empty space to align with Middle Name */}
              <div className="flex-1"></div>
            </div>

            {/* Contact Number & Email */}
            <div className="flex gap-4 col-span-2 sm:col-span-2">
              <div className="flex-1 space-y-1">
                <label className="block text-sm font-medium text-white/80">Contact Number</label>
                <input
                  type="text"
                  name="contactNumber"
                  value={formData.contactNumber}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  className="w-full border-b border-gray-300 focus:outline-none focus:border-blue-500 text-white py-1 bg-transparent"
                />
              </div>
              <div className="flex-1 space-y-1">
                <label className="block text-sm font-medium text-white/80">Email Address</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  disabled
                  className="w-full border-b border-gray-300 focus:outline-none focus:border-blue-500 text-white py-1 bg-transparent"
                />
              </div>
            </div>

            {/* House Address Full Width */}
            <div className="col-span-2 space-y-1">
              <label className="block text-sm font-medium text-white/80">House Address</label>
              <input
                type="text"
                name="houseAddress"
                value={formData.houseAddress}
                onChange={handleInputChange}
                disabled={!isEditing}
                className="w-full border-b border-gray-300 focus:outline-none focus:border-blue-500 text-white py-1 bg-transparent"
              />
            </div>
          </div>


          <h3 className="text-lg font-bold text-white mb-6">Company Information</h3>
          <div className="space-y-6">
            {["companyName", "companyAddress"].map((field) => (
              <div key={field} className="space-y-1">
                <label className="block text-sm font-medium text-white/80 capitalize">
                  {field.replace(/([A-Z])/g, ' $1')}
                </label>
                <input
                  type="text"
                  name={field}
                  value={(formData as any)[field]}
                  onChange={handleInputChange}
                  disabled={true} // Always read-only
                  className="w-full border-b border-gray-300 focus:outline-none focus:border-blue-500 text-white py-1 bg-transparent"
                />
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
};

export default Account;
