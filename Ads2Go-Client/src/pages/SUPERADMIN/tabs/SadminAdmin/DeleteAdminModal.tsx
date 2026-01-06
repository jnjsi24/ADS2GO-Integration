import React from 'react';
import { Admin } from './types';

interface DeleteAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  admin: Admin | null;
}

const DeleteAdminModal: React.FC<DeleteAdminModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  admin,
}) => {
  if (!isOpen || !admin) return null;

  return (
    <div className="fixed inset-0 sm:bottom-4 sm:right-4 sm:inset-auto z-50 flex items-center sm:items-end justify-center sm:justify-end p-4">
      <div className="bg-[#3674B5] p-4 sm:p-6 lg:p-8 rounded-lg shadow-xl max-w-sm w-full transform transition-transform duration-300 ease-in-out animate-slideIn">
        <h3 className="text-lg sm:text-xl font-semibold text-white mb-3 sm:mb-4">Confirm Deletion</h3>
        <p className="text-sm sm:text-base text-white mb-4 sm:mb-6">
          Are you sure you want to delete admin{' '}
          <span className="font-bold">
            {admin?.firstName || 'this admin'} {admin?.lastName || ''}
          </span>
          ? This action cannot be undone.
        </p>
        <div className="flex flex-col sm:flex-row justify-between gap-2 sm:gap-0 pt-4">
          <button
            onClick={onClose}
            className="px-4 sm:px-5 py-2 text-sm sm:text-base rounded-lg hover:bg-gray-400 hover:text-black border border-gray-300 text-white"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm sm:text-base rounded-lg bg-red-600 text-white hover:bg-red-700"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteAdminModal;
