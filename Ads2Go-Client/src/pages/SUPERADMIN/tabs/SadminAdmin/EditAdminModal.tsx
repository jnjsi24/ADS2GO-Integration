import React from 'react';
import { EditAdminFormData, EditErrors } from './types';

interface EditAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  formData: EditAdminFormData;
  setFormData: (data: EditAdminFormData) => void;
  errors: EditErrors;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const EditAdminModal: React.FC<EditAdminModalProps> = ({
  isOpen,
  onClose,
  formData,
  setFormData,
  errors,
  onSubmit,
  onInputChange,
}) => {
  if (!isOpen) return null;

  const FloatingInput = ({
    id,
    name,
    type = 'text',
    label,
    value,
    onChange,
    required = false,
    error,
  }: {
    id: string;
    name: string;
    type?: string;
    label: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    required?: boolean;
    error?: string;
  }) => (
    <div className="relative">
      <input
        id={id}
        name={name}
        type={type}
        placeholder=" "
        required={required}
        value={value}
        onChange={onChange}
        className={`peer w-full px-0 pt-5 pb-2 border-b bg-transparent text-gray-900 focus:outline-none focus:border-[#3674B5] placeholder-transparent transition ${
          error ? 'border-red-400' : 'border-gray-300'
        }`}
      />
      <label
        htmlFor={id}
        className={`absolute left-0 bg-transparent transition-all duration-200
          ${
            value
              ? '-top-2 text-sm text-gray-700 font-semibold'
              : 'peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-500'
          }
          peer-focus:-top-2 peer-focus:text-sm peer-focus:text-gray-700 peer-focus:font-semibold`}
      >
        {label}
      </label>
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black bg-opacity-30"
        onClick={onClose}
      />
      {/* Centered Modal */}
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-xl p-8 animate-slideIn">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-[#3674B5]">Edit Admin</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-xl font-bold"
          >
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
            <FloatingInput
              id="editFirstName"
              name="firstName"
              label="First Name"
              value={formData.firstName}
              onChange={onInputChange}
              required
              error={errors.firstName}
            />

            <FloatingInput
              id="editMiddleName"
              name="middleName"
              label="Middle Name"
              value={formData.middleName || ''}
              onChange={onInputChange}
            />

            <FloatingInput
              id="editLastName"
              name="lastName"
              label="Last Name"
              value={formData.lastName}
              onChange={onInputChange}
              required
              error={errors.lastName}
            />

            <FloatingInput
              id="editEmail"
              name="email"
              type="email"
              label="Email Address"
              value={formData.email}
              onChange={onInputChange}
              required
              error={errors.email}
            />

            {/* Contact Number with +63 prefix */}
            <div className="relative">
              <div className="flex items-end">
                <span className="pr-2 mb-2 text-gray-600">+63</span>
                <input
                  id="editContactNumber"
                  name="contactNumber"
                  type="tel"
                  placeholder=" "
                  value={formData.contactNumber.replace('+63 ', '')}
                  onChange={onInputChange}
                  maxLength={10}
                  className={`peer w-full px-0 pt-5 pb-2 border-b bg-transparent text-gray-900 focus:outline-none focus:border-[#3674B5] placeholder-transparent transition ${
                    errors.contactNumber ? 'border-red-400' : 'border-gray-300'
                  }`}
                />
              </div>
              <label
                htmlFor="editContactNumber"
                className={`absolute left-8 bg-transparent transition-all duration-200
                  ${
                    formData.contactNumber
                      ? '-top-2 text-sm text-gray-700 font-semibold'
                      : 'peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-500'
                  }
                  peer-focus:-top-2 peer-focus:text-sm peer-focus:text-gray-700 peer-focus:font-semibold`}
              >
                Phone Number
              </label>
              {errors.contactNumber && (
                <p className="text-red-500 text-xs mt-1">{errors.contactNumber}</p>
              )}
            </div>

            <FloatingInput
              id="editCompanyName"
              name="companyName"
              label="Company Name"
              value={formData.companyName}
              onChange={onInputChange}
              error={errors.companyName}
            />

            <FloatingInput
              id="editCompanyAddress"
              name="companyAddress"
              label="Company Address"
              value={formData.companyAddress}
              onChange={onInputChange}
              error={errors.companyAddress}
            />

            <FloatingInput
              id="editPassword"
              name="password"
              type="password"
              label="New Password (optional)"
              value={formData.password || ''}
              onChange={onInputChange}
            />

            {/* Profile Picture */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Profile Picture (optional)
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setFormData((prev) => ({
                      ...prev,
                      profilePicture: e.target.files![0],
                    }));
                  }
                }}
                className="w-full py-2 border-b border-gray-300 bg-transparent focus:outline-none focus:border-[#3674B5]"
              />
            </div>
          </div>

          <div className="flex justify-between pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-1 rounded-lg hover:bg-gray-100 text-gray-700 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={Object.values(errors).some((error) => error !== '')}
              className="bg-[#3674B5] text-white px-4 py-3 rounded-lg font-semibold hover:bg-[#1b5087] transition-colors shadow-md disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Update Admin
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditAdminModal;
