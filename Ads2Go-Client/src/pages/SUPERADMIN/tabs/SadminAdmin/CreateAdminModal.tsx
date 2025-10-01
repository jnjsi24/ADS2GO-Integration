import React, { useState } from 'react';
import { UserPlus, Eye, EyeOff } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black bg-opacity-30"
        onClick={onClose}
      ></div>
      <div className="relative w-full max-w-xl bg-gray-100 shadow-lg rounded-lg transform transition-all duration-300 ease-in-out animate-popUp">
        <div className="p-6 max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-[#3674B5]">Add New Admin</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <form onSubmit={onSubmit} className="space-y-6">
            {/* Profile Picture */}
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
              {/* First Name */}
              <div className="relative">
                <input
                  id="newAdminFirstName"
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={onInputChange}
                  className={`peer w-full px-0 pt-5 pb-2 border-b bg-transparent focus:outline-none focus:border-[#3674B5] focus:ring-0 placeholder-transparent transition-colors ${errors.firstName ? 'border-red-400' : 'border-gray-300'}`}
                  style={{ backgroundColor: 'transparent' }}
                  required
                />
                <label
                  htmlFor="newAdminFirstName"
                  className={`absolute left-0 text-gray-500 bg-transparent transition-all duration-200 ${formData.firstName
                    ? '-top-2 text-sm text-gray-700 font-bold'
                    : 'peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-500'} peer-focus:-top-2 peer-focus:text-sm peer-focus:text-gray-700 peer-focus:font-bold`}
                >
                  First Name *
                </label>
                {errors.firstName && (
                  <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>
                )}
              </div>
              {/* Middle Name */}
              <div className="relative">
                <input
                  id="newAdminMiddleName"
                  type="text"
                  name="middleName"
                  value={formData.middleName}
                  onChange={onInputChange}
                  className={`peer w-full px-0 pt-5 pb-2 border-b bg-transparent focus:outline-none focus:border-[#3674B5] focus:ring-0 placeholder-transparent transition-colors ${errors.middleName ? 'border-red-400' : 'border-gray-300'}`}
                  style={{ backgroundColor: 'transparent' }}
                />
                <label
                  htmlFor="newAdminMiddleName"
                  className={`absolute left-0 text-gray-500 bg-transparent transition-all duration-200 ${formData.middleName
                    ? '-top-2 text-sm text-gray-700 font-bold'
                    : 'peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-500'} peer-focus:-top-2 peer-focus:text-sm peer-focus:text-gray-700 peer-focus:font-bold`}
                >
                  Middle Name
                </label>
                {errors.middleName && (
                  <p className="text-red-500 text-xs mt-1">{errors.middleName}</p>
                )}
              </div>
              {/* Last Name */}
              <div className="relative">
                <input
                  id="newAdminLastName"
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={onInputChange}
                  className={`peer w-full px-0 pt-5 pb-2 border-b bg-transparent focus:outline-none focus:border-[#3674B5] focus:ring-0 placeholder-transparent transition-colors ${errors.lastName ? 'border-red-400' : 'border-gray-300'}`}
                  style={{ backgroundColor: 'transparent' }}
                  required
                />
                <label
                  htmlFor="newAdminLastName"
                  className={`absolute left-0 text-gray-500 bg-transparent transition-all duration-200 ${formData.lastName
                    ? '-top-2 text-sm text-gray-700 font-bold'
                    : 'peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-500'} peer-focus:-top-2 peer-focus:text-sm peer-focus:text-gray-700 peer-focus:font-bold`}
                >
                  Last Name *
                </label>
                {errors.lastName && (
                  <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>
                )}
              </div>
            </div>
            {/* Email */}
            <div className="relative">
              <input
                id="newAdminEmail"
                type="email"
                name="email"
                value={formData.email}
                onChange={onInputChange}
                className={`peer w-full px-0 pt-5 pb-2 border-b bg-transparent focus:outline-none focus:border-[#3674B5] focus:ring-0 placeholder-transparent transition-colors ${errors.email ? 'border-red-400' : 'border-gray-300'}`}
                style={{ backgroundColor: 'transparent' }}
                required
              />
              <label
                htmlFor="newAdminEmail"
                className={`absolute left-0 text-gray-500 bg-transparent transition-all duration-200 ${formData.email
                  ? '-top-2 text-sm text-gray-700 font-bold'
                  : 'peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-500'} peer-focus:-top-2 peer-focus:text-sm peer-focus:text-gray-700 peer-focus:font-bold`}
              >
                Email *
              </label>
              {errors.email && (
                <p className="text-red-500 text-xs mt-1">{errors.email}</p>
              )}
            </div>
            {/* Company Name */}
            <div className="relative">
              <input
                id="newAdminCompanyName"
                type="text"
                name="companyName"
                value={formData.companyName}
                onChange={onInputChange}
                className={`peer w-full px-0 pt-5 pb-2 border-b bg-transparent focus:outline-none focus:border-[#3674B5] focus:ring-0 placeholder-transparent transition-colors ${errors.companyName ? 'border-red-400' : 'border-gray-300'}`}
                style={{ backgroundColor: 'transparent' }}
                required
              />
              <label
                htmlFor="newAdminCompanyName"
                className={`absolute left-0 text-gray-500 bg-transparent transition-all duration-200 ${formData.companyName
                  ? '-top-2 text-sm text-gray-700 font-bold'
                  : 'peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-500'} peer-focus:-top-2 peer-focus:text-sm peer-focus:text-gray-700 peer-focus:font-bold`}
              >
                Company Name *
              </label>
              {errors.companyName && (
                <p className="text-red-500 text-xs mt-1">{errors.companyName}</p>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
              {/* Password */}
              <div className="relative">
                <input
                  id="newAdminPassword"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={onInputChange}
                  className={`peer w-full px-0 pt-5 pb-2 pr-8 border-b bg-transparent focus:outline-none focus:border-[#3674B5] focus:ring-0 placeholder-transparent transition-colors ${errors.password ? 'border-red-400' : 'border-gray-300'}`}
                  style={{ backgroundColor: 'transparent' }}
                  required
                />
                <label
                  htmlFor="newAdminPassword"
                  className={`absolute left-0 text-gray-500 bg-transparent transition-all duration-200 ${formData.password
                    ? '-top-2 text-sm text-gray-700 font-bold'
                    : 'peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-500'} peer-focus:-top-2 peer-focus:text-sm peer-focus:text-gray-700 peer-focus:font-bold`}
                >
                  Password *
                </label>
                <button
                  type="button"
                  onClick={togglePasswordVisibility}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  key={`password-toggle-${showPassword}`}
                >
                  {showPassword ? <Eye size={20} /> : <EyeOff size={20} />}
                </button>
                {errors.password && (
                  <p className="text-red-500 text-xs mt-1">{errors.password}</p>
                )}
              </div>
              {/* Confirm Password */}
              <div className="relative">
                <input
                  id="newAdminConfirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={onInputChange}
                  className={`peer w-full px-0 pt-5 pb-2 pr-8 border-b bg-transparent focus:outline-none focus:border-[#3674B5] focus:ring-0 placeholder-transparent transition-colors ${errors.confirmPassword ? 'border-red-400' : 'border-gray-300'}`}
                  style={{ backgroundColor: 'transparent' }}
                  required
                />
                <label
                  htmlFor="newAdminConfirmPassword"
                  className={`absolute left-0 text-gray-500 bg-transparent transition-all duration-200 ${formData.confirmPassword
                    ? '-top-2 text-sm text-gray-700 font-bold'
                    : 'peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-500'} peer-focus:-top-2 peer-focus:text-sm peer-focus:text-gray-700 peer-focus:font-bold`}
                >
                  Confirm Password *
                </label>
                <button
                  type="button"
                  onClick={toggleConfirmPasswordVisibility}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  key={`confirm-password-toggle-${showConfirmPassword}`}
                >
                  {showConfirmPassword ? <Eye size={20} /> : <EyeOff size={20} />}
                </button>
                {errors.confirmPassword && (
                  <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-y-6">
              {/* Contact Number */}
              <div className="relative">
                <div className="flex items-center border-b border-gray-300 focus-within:border-[#3674B5] transition-colors">
                  <span className={`text-gray-700 select-none pr-1 ${formData.contactNumber ? 'pt-5 pb-2' : 'top-4'} text-base`}>+63</span>
                  <input
                    id="newAdminContactNumber"
                    name="contactNumber"
                    type="tel"
                    value={formData.contactNumber}
                    onChange={onInputChange}
                    maxLength={10}
                    className={`peer flex-grow px-0 pt-5 pb-2 bg-transparent focus:outline-none focus:ring-0 placeholder-transparent transition-colors ${errors.contactNumber ? 'border-red-400' : 'border-gray-300'}`}
                    style={{ backgroundColor: 'transparent' }}
                    required
                  />
                  <label
                    htmlFor="newAdminContactNumber"
                    className={`absolute left-8 text-gray-500 bg-transparent transition-all duration-200 ${formData.contactNumber
                      ? '-top-2 text-sm text-gray-700 font-bold'
                      : 'peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-500'} peer-focus:-top-2 peer-focus:text-sm peer-focus:text-gray-700 peer-focus:font-bold`}
                  >
                    Contact Number *
                  </label>
                </div>
                {errors.contactNumber && (
                  <p className="text-red-500 text-xs mt-1">{errors.contactNumber}</p>
                )}
              </div>
              <div className="text-xs text-gray-500 mt-2">
                * Required fields
              </div>
              {/* Company Address */}
              <div className="relative">
                <input
                  id="newAdminCompanyAddress"
                  type="text"
                  name="companyAddress"
                  value={formData.companyAddress}
                  onChange={onInputChange}
                  className={`peer w-full px-0 pt-5 pb-2 border-b bg-transparent focus:outline-none focus:border-[#3674B5] focus:ring-0 placeholder-transparent transition-colors ${errors.companyAddress ? 'border-red-400' : 'border-gray-300'}`}
                  style={{ backgroundColor: 'transparent' }}
                  required
                />
                <label
                  htmlFor="newAdminCompanyAddress"
                  className={`absolute left-0 text-gray-500 bg-transparent transition-all duration-200 ${formData.companyAddress
                    ? '-top-2 text-sm text-gray-700 font-bold'
                    : 'peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-500'} peer-focus:-top-2 peer-focus:text-sm peer-focus:text-gray-700 peer-focus:font-bold`}
                >
                  Company Address *
                </label>
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