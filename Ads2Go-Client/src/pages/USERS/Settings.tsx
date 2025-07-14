"use client";

import { useState } from "react";

export default function Settings() {
  const [isEditing, setIsEditing] = useState(false);

  const user = {
    firstName: "Alexa",
    middleName: "–",
    lastName: "Rawles",
    email: "alexarawles@gmail.com",
    phone: "",
    companyName: "",
    companyAddress: "",
    profileImage: "https://i.pravatar.cc/150?img=32", // Placeholder image
  };

  const handleEditToggle = () => setIsEditing(!isEditing);

  return (
    <div className="max-w-5xl mx-auto p-8">
      {/* Profile Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          <img
            src={user.profileImage}
            alt="Profile"
            className="w-20 h-20 rounded-full object-cover"
          />
          <div>
            <h2 className="text-xl font-semibold">{`${user.firstName} ${user.lastName}`}</h2>
            <p className="text-gray-500">{user.email}</p>
          </div>
        </div>
        <button
          onClick={handleEditToggle}
          className="bg-gray-900 text-white px-4 py-2 rounded-md"
        >
          {isEditing ? "Cancel" : "Edit"}
        </button>
      </div>

      {/* Form Fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
          <input
            type="text"
            defaultValue={user.firstName}
            readOnly={!isEditing}
            className="w-full px-4 py-2 border border-gray-300 rounded bg-gray-100"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Middle Name</label>
          <input
            type="text"
            defaultValue={user.middleName}
            readOnly={!isEditing}
            className="w-full px-4 py-2 border border-gray-300 rounded bg-gray-100"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
          <input
            type="text"
            defaultValue={user.lastName}
            readOnly={!isEditing}
            className="w-full px-4 py-2 border border-gray-300 rounded bg-gray-100"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
          <input
            type="text"
            defaultValue={user.companyName}
            readOnly={!isEditing}
            className="w-full px-4 py-2 border border-gray-300 rounded bg-gray-100"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Company Address</label>
          <input
            type="text"
            defaultValue={user.companyAddress}
            readOnly={!isEditing}
            className="w-full px-4 py-2 border border-gray-300 rounded bg-gray-100"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Contact Number</label>
          <input
            type="text"
            defaultValue={user.phone}
            readOnly={!isEditing}
            className="w-full px-4 py-2 border border-gray-300 rounded bg-gray-100"
          />
        </div>

        <div className="col-span-1 sm:col-span-2 lg:col-span-3">
          <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
          <input
            type="email"
            defaultValue={user.email}
            readOnly={!isEditing}
            className="w-full px-4 py-2 border border-gray-300 rounded bg-gray-100"
          />
        </div>
      </div>

      {/* Change Password Button */}
      <div className="flex justify-center">
        <button className="bg-gray-900 text-white px-6 py-2 rounded-md">
          Change Password
        </button>
      </div>
    </div>
  );
}
