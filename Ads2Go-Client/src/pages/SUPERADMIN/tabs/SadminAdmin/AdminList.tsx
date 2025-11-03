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
  return (
    <div className="mx-6 mt-4 rounded-md overflow-hidden">
      {/* Header */}
      <div className={`grid gap-4 px-6 py-3 text-sm font-semibold text-black/80 ${
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
              className={`grid gap-4 px-6 py-4 bg-white rounded-xl shadow-md items-center hover:shadow-lg transition-colors ${
                activeTab === 'archived' ? 'grid-cols-[1.5fr_1fr_1fr_1.5fr_1fr_1fr_120px]' : 'grid-cols-[1.5fr_1fr_1fr_1.5fr_1fr_120px]'
              }`}
            >
              {/* Name + Avatar */}
              <div className="flex items-center space-x-3">
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
              <p className="text-sm text-gray-900">{admin.companyName || 'N/A'}</p>
              <p className="text-sm text-gray-900">{admin.contactNumber || 'N/A'}</p>
              <p className="text-sm text-gray-900 truncate">{admin.email}</p>
              {activeTab === 'archived' && (
                <div className="text-sm text-red-600 font-medium">
                  {admin.scheduledDeletionDate ? formatDate(admin.scheduledDeletionDate) : 'N/A'}
                </div>
              )}
              <div className="text-sm text-gray-600">
                {admin.createdAt ? formatDate(admin.createdAt) : 'N/A'}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-center gap-2">
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
        <div className="text-center py-8 text-gray-500">No admins found.</div>
      )}
    </div>
  );
};

export default AdminList;
