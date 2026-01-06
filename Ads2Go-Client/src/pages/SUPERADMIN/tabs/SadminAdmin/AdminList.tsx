import React from 'react';
import { Trash, Pencil, RotateCcw } from 'lucide-react';
import { Admin } from './types';

interface AdminListProps {
  admins: Admin[];
  onEditAdmin: (admin: Admin) => void;
  onDeleteAdmin: (admin: Admin) => void;
  onRestoreAdmin: (admin: Admin) => void;
  formatDate: (dateInput: any) => string;
  activeTab: 'active' | 'archived';
}

const AdminList: React.FC<AdminListProps> = ({
  admins,
  onEditAdmin,
  onDeleteAdmin,
  onRestoreAdmin,
  formatDate,
  activeTab,
}) => {
  const formatContactNumber = (num?: string): string => {
    if (!num) return 'N/A';
    const digits = num.replace(/\D/g, '');
    let tenDigits = '';
    if (digits.startsWith('63') && digits.length >= 12) {
      tenDigits = digits.slice(2, 12);
    } else if (digits.startsWith('0') && digits.length >= 11) {
      tenDigits = digits.slice(1, 11);
    } else if (digits.startsWith('9') && digits.length >= 10) {
      tenDigits = digits.slice(0, 10);
    } else if (digits.length > 10) {
      tenDigits = digits.slice(-10);
    } else {
      tenDigits = digits;
    }
    return tenDigits ? `+63 ${tenDigits}` : 'N/A';
  };
  return (
    <div className="mx-4 sm:mx-6 mt-4 rounded-md overflow-hidden">
      {/* Header - Hidden on mobile, shown on desktop */}
      <div className={`hidden lg:grid gap-4 px-4 sm:px-6 py-3 text-xs sm:text-sm font-semibold text-black/80 ${
        activeTab === 'archived' ? 'grid-cols-[1.5fr_1fr_1fr_1.5fr_1fr_1fr_120px]' : 'grid-cols-[1.5fr_1fr_1fr_1.5fr_1fr_120px]'
      }`}>
        <span>Name</span>
        <span>Company</span>
        <span>Contact</span>
        <span>Email</span>
        {activeTab === 'archived' && <span>Deletion Date</span>}
        <span>Date Created</span>
        <span className="text-center">Actions</span>
      </div>

      {admins.length > 0 ? (
        <ul className="space-y-3 pb-5">
          {admins.map((admin) => (
            <li
              key={admin.id}
              className={`lg:grid gap-4 px-4 sm:px-6 py-4 bg-white rounded-xl shadow-md hover:shadow-lg transition-colors ${
                activeTab === 'archived' 
                  ? 'lg:grid-cols-[1.5fr_1fr_1fr_1.5fr_1fr_1fr_120px]' 
                  : 'lg:grid-cols-[1.5fr_1fr_1fr_1.5fr_1fr_120px]'
              }`}
            >
              {/* Mobile Card Layout */}
              <div className="lg:hidden space-y-3">
                {/* Name + Avatar */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-sm font-semibold overflow-hidden">
                      {admin.profilePicture ? (
                        <img
                          src={admin.profilePicture}
                          alt={`${admin.firstName} ${admin.lastName}`}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const parent = target.parentElement;
                            if (parent) {
                              parent.innerHTML = `${admin.firstName.charAt(0)}${admin.lastName.charAt(0)}`;
                            }
                          }}
                        />
                      ) : (
                        `${admin.firstName.charAt(0)}${admin.lastName.charAt(0)}`
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-sm text-gray-900">
                        {admin.firstName} {admin.lastName}
                      </p>
                      <p className="text-xs text-gray-500 truncate max-w-[200px]">{admin.email}</p>
                    </div>
                  </div>
                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {activeTab === 'archived' ? (
                      <button
                        onClick={() => onRestoreAdmin(admin)}
                        className="p-2 text-green-700 rounded-md hover:bg-green-50 transition-colors"
                        title="Restore"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => onEditAdmin(admin)}
                          className="p-2 text-gray-700 rounded-md hover:bg-gray-100 transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDeleteAdmin(admin)}
                          className="p-2 text-red-700 rounded-md hover:bg-red-50 transition-colors"
                          title="Delete"
                        >
                          <Trash className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                
                {/* Details */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-500">Company:</span>
                    <p className="text-gray-900 font-medium">{admin.companyName || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Contact:</span>
                    <p className="text-gray-900 font-medium">{formatContactNumber(admin.contactNumber)}</p>
                  </div>
                  {activeTab === 'archived' && (
                    <div>
                      <span className="text-gray-500">Deletion Date:</span>
                      <p className="text-red-600 font-medium">
                        {admin.scheduledDeletionDate ? formatDate(admin.scheduledDeletionDate) : 'N/A'}
                      </p>
                    </div>
                  )}
                  <div>
                    <span className="text-gray-500">Created:</span>
                    <p className="text-gray-600 font-medium">
                      {admin.createdAt ? formatDate(admin.createdAt) : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Desktop Grid Layout */}
              {/* Name + Avatar */}
              <div className="hidden lg:flex items-center space-x-3">
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-sm font-semibold overflow-hidden">
                  {admin.profilePicture ? (
                    <img
                      src={admin.profilePicture}
                      alt={`${admin.firstName} ${admin.lastName}`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent) {
                          parent.innerHTML = `${admin.firstName.charAt(0)}${admin.lastName.charAt(0)}`;
                        }
                      }}
                    />
                  ) : (
                    `${admin.firstName.charAt(0)}${admin.lastName.charAt(0)}`
                  )}
                </div>
                <p className="font-medium text-gray-900">
                  {admin.firstName} {admin.lastName}
                </p>
              </div>

              {/* Other Columns */}
              <p className="hidden lg:block text-sm text-gray-900">{admin.companyName || 'N/A'}</p>
              <p className="hidden lg:block text-sm text-gray-900">{formatContactNumber(admin.contactNumber)}</p>
              <p className="hidden lg:block text-sm text-gray-900 truncate">{admin.email}</p>
              {activeTab === 'archived' && (
                <div className="hidden lg:block text-sm text-red-600 font-medium">
                  {admin.scheduledDeletionDate ? formatDate(admin.scheduledDeletionDate) : 'N/A'}
                </div>
              )}
              <div className="hidden lg:block text-sm text-gray-600">
                {admin.createdAt ? formatDate(admin.createdAt) : 'N/A'}
              </div>

              {/* Actions */}
              <div className="hidden lg:flex items-center justify-center gap-2">
                {activeTab === 'archived' ? (
                  /* Restore button for archived tab */
                  <button
                    onClick={() => onRestoreAdmin(admin)}
                    className="group flex items-center text-green-700 rounded-md overflow-hidden h-6 w-7 hover:w-20 transition-[width] duration-300"
                  >
                    <RotateCcw className="w-4 h-4 flex-shrink-0 mx-auto ml-1.5 group-hover:ml-1 transition-all duration-300" />
                    <span className="opacity-0 group-hover:opacity-100 ml-1 group-hover:mr-3 whitespace-nowrap text-xs transition-all duration-300">
                      Restore
                    </span>
                  </button>
                ) : (
                  <>
                    {/* Edit */}
                    <button
                      onClick={() => onEditAdmin(admin)}
                      className="group flex items-center text-gray-700 rounded-md overflow-hidden h-6 w-7 hover:w-16 transition-[width] duration-300"
                    >
                      <Pencil className="w-4 h-4 flex-shrink-0 mx-auto ml-1.5 group-hover:ml-1 transition-all duration-300" />
                      <span className="opacity-0 group-hover:opacity-100 ml-1 group-hover:mr-3 whitespace-nowrap text-xs transition-all duration-300">
                        Edit
                      </span>
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => onDeleteAdmin(admin)}
                      className="group flex items-center text-red-700 rounded-md overflow-hidden h-6 w-7 hover:w-16 transition-[width] duration-300"
                    >
                      <Trash className="w-4 h-4 flex-shrink-0 mx-auto ml-1.5 group-hover:ml-1 transition-all duration-300" />
                      <span className="opacity-0 group-hover:opacity-100 ml-1 group-hover:mr-3 whitespace-nowrap text-xs transition-all duration-300">
                        Delete
                      </span>
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-center py-8 text-sm sm:text-base text-gray-500">No admins found.</div>
      )}
    </div>
  );
};

export default AdminList;
