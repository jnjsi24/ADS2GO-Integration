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

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end p-4">
      <div className="fixed inset-0 bg-black bg-opacity-30" onClick={onClose}></div>
      <div className="relative w-full md:w-1/2 lg:w-1/3 max-w-xl h-auto pb-6 rounded-3xl bg-gray-100 mt-2 shadow-lg transform transition-transform duration-300 ease-in-out animate-slideIn">
        <div className="p-6 h-full overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-[#3674B5]">Edit Admin</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700"></button>
          </div>
          <form onSubmit={onSubmit} className="space-y-4 mt-9">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
              <div>
                <label htmlFor="editFirstName" className="block text-sm font-medium text-gray-500 mb-1">
                  First Name
                </label>
                <input
                  id="editFirstName"
                  name="firstName"
                  type="text"
                  value={formData.firstName}
                  onChange={onInputChange}
                  className="w-full py-2 border-b border-[#3674B5] focus:outline-none focus:border-[#3674B5] transition-colors bg-transparent"
                  required
                />
                {errors.firstName && <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>}
              </div>

              <div>
                <label htmlFor="editMiddleName" className="block text-sm font-medium text-gray-500 mb-1">
                  Middle Name
                </label>
                <input
                  id="editMiddleName"
                  name="middleName"
                  type="text"
                  value={formData.middleName || ''}
                  onChange={onInputChange}
                  className="w-full py-2 border-b border-[#3674B5] focus:outline-none focus:border-[#3674B5] transition-colors bg-transparent"
                />
              </div>

              <div>
                <label htmlFor="editLastName" className="block text-sm font-medium text-gray-500 mb-1">
                  Last Name
                </label>
                <input
                  id="editLastName"
                  name="lastName"
                  type="text"
                  value={formData.lastName}
                  onChange={onInputChange}
                  className="w-full py-2 border-b border-[#3674B5] focus:outline-none focus:border-[#3674B5] transition-colors bg-transparent"
                  required
                />
                {errors.lastName && <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>}
              </div>

              <div>
                <label htmlFor="editEmail" className="block text-sm font-medium text-gray-500 mb-1">
                  Email Address
                </label>
                <input
                  id="editEmail"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={onInputChange}
                  className="w-full py-2 border-b border-[#3674B5] focus:outline-none focus:border-[#3674B5] transition-colors bg-transparent"
                  required
                />
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
              </div>

              <div>
                <label htmlFor="editContactNumber" className="block text-sm font-medium text-gray-500 mb-1">
                  Phone Number
                </label>
                <div className="flex items-center py-2 border-b border-[#3674B5] focus-within:border-[#3674B5] transition-colors">
                  <span className="text-gray-700 select-none pr-1">+63</span>
                  <input
                    id="editContactNumber"
                    name="contactNumber"
                    type="tel"
                    value={formData.contactNumber.replace('+63 ', '')}
                    onChange={onInputChange}
                    maxLength={10}
                    className="flex-grow focus:outline-none bg-transparent"
                  />
                </div>
                {errors.contactNumber && <p className="text-red-500 text-xs mt-1">{errors.contactNumber}</p>}
              </div>

              <div>
                <label htmlFor="editCompanyName" className="block text-sm font-medium text-gray-500 mb-1">
                  Company Name
                </label>
                <input
                  id="editCompanyName"
                  name="companyName"
                  type="text"
                  value={formData.companyName}
                  onChange={onInputChange}
                  className="w-full py-2 border-b border-[#3674B5] focus:outline-none focus:border-[#3674B5] transition-colors bg-transparent"
                />
                {errors.companyName && <p className="text-red-500 text-xs mt-1">{errors.companyName}</p>}
              </div>

              <div>
                <label htmlFor="editCompanyAddress" className="block text-sm font-medium text-gray-500 mb-1">
                  Company Address
                </label>
                <input
                  id="editCompanyAddress"
                  name="companyAddress"
                  type="text"
                  value={formData.companyAddress}
                  onChange={onInputChange}
                  className="w-full py-2 border-b border-[#3674B5] focus:outline-none focus:border-[#3674B5] transition-colors bg-transparent"
                />
                {errors.companyAddress && <p className="text-red-500 text-xs mt-1">{errors.companyAddress}</p>}
              </div>

              <div>
                <label htmlFor="editPassword" className="block text-sm font-medium text-gray-500 mb-1">
                  New Password <span className="text-gray-400 text-xs">(leave blank to keep current)</span>
                </label>
                <input
                  id="editPassword"
                  name="password"
                  type="password"
                  value={formData.password || ''}
                  onChange={onInputChange}
                  className="w-full py-2 border-b border-[#3674B5] focus:outline-none focus:border-[#3674B5] transition-colors bg-transparent"
                />
              </div>

              <div>
                <label htmlFor="editProfilePicture" className="block text-sm font-medium text-gray-500 mb-1">
                  Profile Picture <span className="text-gray-400 text-xs">(leave blank to keep current)</span>
                </label>
                <input
                  id="editProfilePicture"
                  name="profilePicture"
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setFormData(prev => ({
                        ...prev,
                        profilePicture: e.target.files![0]
                      }));
                    }
                  }}
                  className="w-full py-2 border-b border-[#3674B5] focus:outline-none focus:border-[#3674B5] transition-colors bg-transparent"
                />
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 rounded-lg hover:bg-gray-200 border border-gray-300 text-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={Object.values(errors).some((error) => error !== '')}
                className="bg-[#3674B5] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[#1b5087] transition-colors shadow-md disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Update Admin
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EditAdminModal;
