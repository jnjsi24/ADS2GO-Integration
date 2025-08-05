import React, { useState, useEffect, ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Pencil } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { gql, useMutation } from "@apollo/client"; // ✅ Added

// ✅ GraphQL Mutation
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
  cityState?: string;
}

const Account: React.FC = () => {
  const [isEditing, setIsEditing] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  const [formData, setFormData] = useState<FormData>({
    firstName: "",
    middleName: "",
    lastName: "",
    companyName: "",
    companyAddress: "",
    contactNumber: "",
    email: "",
    profilePicture: "",
    cityState: "",
  });

  // ✅ Apollo Mutation
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
        cityState: user.houseAddress || "",
      });
    }
  }, [user]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
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

  // ✅ Send to backend when Save is clicked
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
              houseAddress: formData.cityState,
            },
          },
        });

        if (data.updateUser.success) {
          console.log("Updated successfully:", data.updateUser.user);
          alert("Profile updated successfully!");
        } else {
          console.error("Update failed:", data.updateUser.message);
          alert("Update failed: " + data.updateUser.message);
        }
      } catch (error: any) {
        console.error("Error updating profile:", error.message);
        alert("Something went wrong: " + error.message);
      }
    }

    setIsEditing((prev) => !prev);
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
        cityState: user.houseAddress || "",
      });
    }
    setIsEditing(false);
  };

  return (
    <div className="min-h-screen bg-white text-gray-700 p-8 flex pl-60 justify-center">
      <main className="w-full max-w-4xl"> 
        {/* Profile Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center space-x-4">
            <img
              src={formData.profilePicture || "https://via.placeholder.com/100"}
              alt="Profile"
              className="w-16 h-16 rounded-full object-cover"
            />
            <div>
              <h2 className="text-lg font-semibold">
                {formData.firstName || "User Name"}
              </h2>
              <p className="text-gray-500 text-sm">{formData.email}</p>
              <p className="text-gray-500 text-sm">{formData.cityState}</p>
            </div>
          </div>
          <div className="flex flex-col items-end space-y-2">
            {!isEditing ? (
              <button
                onClick={toggleEdit}
                className="flex items-center justify-center gap-2 bg-[#F3A26D] w-20 text-white px-3 py-1 rounded hover:bg-[#E08B52] text-sm"
              >
                <Pencil size={16} />
                Edit
              </button>
            ) : (
              <div className="space-x-2">
                <button
                  onClick={handleCancel}
                  className="text-gray-500 hover:text-gray-700 text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={toggleEdit}
                  className="bg-[#F3A26D] text-white px-3 py-1 rounded hover:bg-[#E08B52] text-sm"
                >
                  Save
                </button>
              </div>
            )}
            {isEditing && (
              <div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="w-full text-sm"
                />
              </div>
            )}
          </div>
        </div>

        {/* Personal Info Section */}
        <div className="border p-4 rounded-md mt-6">
          <h3 className="text-lg font-semibold mb-4">Personal Information</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">First Name</label>
              <input
                name="firstName"
                value={formData.firstName}
                onChange={handleInputChange}
                disabled={!isEditing}
                className="w-full border rounded px-3 py-2 text-sm bg-gray-50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Middle Name</label>
              <input
                name="middleName"
                value={formData.middleName}
                onChange={handleInputChange}
                disabled={!isEditing}
                className="w-full border rounded px-3 py-2 text-sm bg-gray-50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Last Name</label>
              <input
                name="lastName"
                value={formData.lastName}
                onChange={handleInputChange}
                disabled={!isEditing}
                className="w-full border rounded px-3 py-2 text-sm bg-gray-50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Phone</label>
              <input
                name="contactNumber"
                value={formData.contactNumber}
                onChange={handleInputChange}
                disabled={!isEditing}
                className="w-full border rounded px-3 py-2 text-sm bg-gray-50"
              />
            </div>
          </div>
        </div>

        {/* Company Info Section */}
        <div className="border p-4 rounded-md mt-6">
          <h3 className="text-lg font-semibold mb-4">Company Information</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">Company Name</label>
              <input
                name="companyName"
                value={formData.companyName}
                onChange={handleInputChange}
                disabled={!isEditing}
                className="w-full border rounded px-3 py-2 text-sm bg-gray-50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Company Email</label>
              <input
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                disabled={!isEditing}
                className="w-full border rounded px-3 py-2 text-sm bg-gray-50"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1">Company Address</label>
              <input
                name="companyAddress"
                value={formData.companyAddress}
                onChange={handleInputChange}
                disabled={!isEditing}
                className="w-full border rounded px-3 py-2 text-sm bg-gray-50"
              />
            </div>
          </div>
        </div>

        {/* Address Section */}
        <div className="border p-4 rounded-md mt-6">
          <h3 className="text-lg font-semibold mb-4">Address</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">City/State</label>
              <input
                name="cityState"
                value={formData.cityState}
                onChange={handleInputChange}
                disabled={!isEditing}
                className="w-full border rounded px-3 py-2 text-sm bg-gray-50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Postal Code</label>
              <input
                value="ERT 2354"
                disabled
                className="w-full border rounded px-3 py-2 text-sm bg-gray-50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">TAX ID</label>
              <input
                value="AS4546756"
                disabled
                className="w-full border rounded px-3 py-2 text-sm bg-gray-50"
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Account;