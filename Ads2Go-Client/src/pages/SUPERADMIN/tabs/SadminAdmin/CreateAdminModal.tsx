import React, { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { AdminFormData, FormErrors } from './types';

interface CreateAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  formData: AdminFormData;
  setFormData: (data: AdminFormData) => void;
  errors: FormErrors;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const CreateAdminModal: React.FC<CreateAdminModalProps> = ({
  isOpen,
  onClose,
  formData,
  setFormData,
  errors,
  onSubmit,
  onInputChange,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const togglePasswordVisibility = () => setShowPassword(!showPassword);
  const toggleConfirmPasswordVisibility = () => setShowConfirmPassword(!showConfirmPassword);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end pr-2">
      <div
        className="fixed inset-0 bg-black bg-opacity-30"
        onClick={onClose}
      ></div>
      <div className="relative w-full md:w-1/2 lg:w-1/3 max-w-xl h-full pb-6 rounded-l-3xl bg-gray-100 shadow-lg transform transition-transform duration-300 ease-in-out animate-slideIn">
        <div className="p-6 h-full overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-[#3674B5]">Add New Admin</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            ></button>
          </div>
          <form onSubmit={onSubmit} className="space-y-6">
            {/* Profile Picture at the top */}
            <div className="flex flex-col items-center mb-6">
              <label htmlFor="newAdminProfilePicture" className="block text-sm font-medium text-gray-500 mb-2">
                Profile Picture
              </label>
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden border-2 border-[#3674B5]">
                  {formData.profilePicture ? (
                    <img 
                      src={URL.createObjectURL(formData.profilePicture as Blob)} 
                      alt="Profile Preview" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <UserPlus size={32} className="text-gray-400" />
                  )}
                </div>
                <input
                  id="newAdminProfilePicture"
                  type="file"
                  name="profilePicture"
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setFormData({
                        ...formData,
                        profilePicture: e.target.files[0]
                      });
                    }
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>
              <span className="mt-2 text-xs text-gray-500">Click to upload</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
              <div>
                <label htmlFor="newAdminFirstName" className="block text-sm font-medium text-gray-500 mb-1">
                  First Name *
                </label>
                <input
                  id="newAdminFirstName"
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={onInputChange}
                  className="w-full py-2 border-b border-[#3674B5] focus:outline-none focus:border-[#3674B5] transition-colors bg-transparent"
                  required
                />
                {errors.firstName && (
                  <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>
                )}
              </div>
              <div>
                <label htmlFor="newAdminMiddleName" className="block text-sm font-medium text-gray-500 mb-1">
                  Middle Name
                </label>
                <input
                  id="newAdminMiddleName"
                  type="text"
                  name="middleName"
                  value={formData.middleName}
                  onChange={onInputChange}
                  className="w-full py-2 border-b border-[#3674B5] focus:outline-none focus:border-[#3674B5] transition-colors bg-transparent"
                />
                {errors.middleName && (
                  <p className="text-red-500 text-xs mt-1">{errors.middleName}</p>
                )}
              </div>
              <div>
                <label htmlFor="newAdminLastName" className="block text-sm font-medium text-gray-500 mb-1">
                  Last Name *
                </label>
                <input
                  id="newAdminLastName"
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={onInputChange}
                  className="w-full py-2 border-b border-[#3674B5] focus:outline-none focus:border-[#3674B5] transition-colors bg-transparent"
                  required
                />
                {errors.lastName && (
                  <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>
                )}
              </div>
            </div>
            <div>
              <label htmlFor="newAdminEmail" className="block text-sm font-medium text-gray-500 mb-1">
                Email *
              </label>
              <input
                id="newAdminEmail"
                type="email"
                name="email"
                value={formData.email}
                onChange={onInputChange}
                className="w-full py-2 border-b border-[#3674B5] focus:outline-none focus:border-[#3674B5] transition-colors bg-transparent"
                required
              />
              {errors.email && (
                <p className="text-red-500 text-xs mt-1">{errors.email}</p>
              )}
            </div>
            <div>
              <label htmlFor="newAdminCompanyName" className="block text-sm font-medium text-gray-500 mb-1">
                Company Name *
              </label>
              <input
                id="newAdminCompanyName"
                type="text"
                name="companyName"
                value={formData.companyName}
                onChange={onInputChange}
                className="w-full py-2 border-b border-[#3674B5] focus:outline-none focus:border-[#3674B5] transition-colors bg-transparent"
                required
              />
              {errors.companyName && (
                <p className="text-red-500 text-xs mt-1">{errors.companyName}</p>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
              <div>
                <label htmlFor="newAdminPassword" className="block text-sm font-medium text-gray-500 mb-1">
                  Password *
                </label>
                <div className="relative">
                  <input
                    id="newAdminPassword"
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={onInputChange}
                    className="w-full py-2 pr-8 border-b border-[#3674B5] focus:outline-none focus:border-[#3674B5] transition-colors bg-transparent"
                    required
                  />
                  <button
                    type="button"
                    onClick={togglePasswordVisibility}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-red-500 text-xs mt-1">{errors.password}</p>
                )}
              </div>
              <div>
                <label htmlFor="newAdminConfirmPassword" className="block text-sm font-medium text-gray-500 mb-1">
                  Confirm Password *
                </label>
                <div className="relative">
                  <input
                    id="newAdminConfirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={onInputChange}
                    className="w-full py-2 pr-8 border-b border-[#3674B5] focus:outline-none focus:border-[#3674B5] transition-colors bg-transparent"
                    required
                  />
                  <button
                    type="button"
                    onClick={toggleConfirmPasswordVisibility}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-y-6">
              <div>
                <label htmlFor="newAdminContactNumber" className="block text-sm font-medium text-gray-500 mb-1">
                  Contact Number *
                </label>
                <div className="flex items-center py-2 border-b border-[#3674B5] focus-within:border-[#3674B5] transition-colors">
                  <span className="text-gray-700 select-none pr-1">+63</span>
                  <input
                    id="newAdminContactNumber"
                    name="contactNumber"
                    type="tel"
                    value={formData.contactNumber}
                    onChange={onInputChange}
                    maxLength={10}
                    className="flex-grow focus:outline-none bg-transparent"
                    required
                  />
                </div>
                {errors.contactNumber && (
                  <p className="text-red-500 text-xs mt-1">{errors.contactNumber}</p>
                )}
              </div>
              <div className="text-xs text-gray-500 mt -2">
                * Required fields
              </div>
              <div>
                <label htmlFor="newAdminCompanyAddress" className="block text-sm font-medium text-gray-500 mb-1">
                  Company Address *
                </label>
                <input
                  id="newAdminCompanyAddress"
                  type="text"
                  name="companyAddress"
                  value={formData.companyAddress}
                  onChange={onInputChange}
                  className="w-full py-2 border-b border-[#3674B5] focus:outline-none focus:border-[#3674B5] transition-colors bg-transparent"
                  required
                />
                {errors.companyAddress && (
                  <p className="text-red-500 text-xs mt-1">{errors.companyAddress}</p>
                )}
              </div>
            </div>
            <div className="flex justify-between pt-6">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 rounded-lg hover:bg-gray-200 border border-gray-300 text-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 rounded-lg bg-[#3674B5] hover:bg-[#0E2A47] text-white font-semibold shadow hover:scale-105 transition-all duration-300 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Create Admin
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateAdminModal;
