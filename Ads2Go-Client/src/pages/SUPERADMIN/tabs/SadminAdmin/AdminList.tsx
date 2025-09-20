import React from 'react';
import { Trash2, Pencil } from 'lucide-react';
import { Admin } from './types';

interface AdminListProps {
  admins: Admin[];
  onEditAdmin: (admin: Admin) => void;
  onDeleteAdmin: (admin: Admin) => void;
  formatDate: (dateInput: any) => string;
}

const AdminList: React.FC<AdminListProps> = ({
  admins,
  onEditAdmin,
  onDeleteAdmin,
  formatDate,
}) => {
  return (
    <div className="mx-6 mt-4 rounded-xl overflow-hidden">
      <div className="grid grid-cols-[1.5fr_1fr_1fr_1.5fr_1fr_0.5fr] gap-4 px-6 py-3 text-sm font-semibold text-[#3674B5] bg-gray-100">
        <span>Name</span>
        <span>Company</span>
        <span>Contact</span>
        <span>Email</span>
        <span>Date Created</span>
        <span className="text-center">Actions</span>
      </div>
      {admins.length > 0 ? (
        <ul className="space-y-3 pb-5">
          {admins.map((admin) => (
            <li
              key={admin.id}
              className="group grid grid-cols-[1.5fr_1fr_1fr_1.5fr_1fr_0.5fr] gap-4 px-6 py-4 bg-white rounded-xl h-20 shadow-md items-center hover:bg-[#3674B5] transition-colors"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-sm font-semibold group-hover:bg-white group-hover:text-[#3674B5] overflow-hidden">
                  {admin.profilePicture ? (
                    <img 
                      src={admin.profilePicture} 
                      alt={`${admin.firstName} ${admin.lastName}`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        // Fallback to initials if image fails to load
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
                <p className="font-medium text-gray-900 group-hover:text-white">
                  {admin.firstName} {admin.lastName}
                </p>
              </div>
              <p className="text-sm text-gray-900 group-hover:text-white">{admin.companyName || 'N/A'}</p>
              <p className="text-sm text-gray-900 group-hover:text-white">{admin.contactNumber || 'N/A'}</p>
              <p className="text-sm text-gray-900 truncate group-hover:text-white">{admin.email}</p>
              <div className="text-sm text-gray-600 group-hover:text-white">
                <span>{admin.createdAt ? formatDate(admin.createdAt) : 'N/A'}</span>
              </div>
              <div className="flex justify-center space-x-2">
                <button
                  onClick={() => onEditAdmin(admin)}
                  className="p-2 rounded-full hover:bg-[#0E2A47] group-hover:text-white"
                >
                  <Pencil size={18} />
                </button>
                <button
                  onClick={() => onDeleteAdmin(admin)}
                  className="p-2 rounded-full hover:bg-[#0E2A47] group-hover:text-white"
                >
                  <Trash2 size={18} />
                </button>
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
