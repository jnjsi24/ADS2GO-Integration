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
    <div className="fixed bottom-4 right-4 z-50 flex items-end justify-end">
      <div className="bg-[#3674B5] p-8 rounded-lg shadow-xl max-w-sm w-full transform transition-transform duration-300 ease-in-out animate-slideIn">
        <h3 className="text-xl font-semibold text-white mb-4">Confirm Deletion</h3>
        <p className="text-white mb-6">
          Are you sure you want to delete admin{' '}
          <span className="font-bold">
            {admin?.firstName || 'this admin'} {admin?.lastName || ''}
          </span>
          ? This action cannot be undone.
        </p>
        <div className="flex justify-between pt-4">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg hover:bg-gray-400 hover:text-black border border-gray-300 text-white"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteAdminModal;
