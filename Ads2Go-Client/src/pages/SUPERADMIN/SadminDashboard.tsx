import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface Admin {
  id: number;
  name: string;
  email: string;
}

const SadminDashboard: React.FC = () => {
  const [admins, setAdmins] = useState<Admin[]>([
    { id: 1, name: 'Admin One', email: 'adminone@example.com' },
    { id: 2, name: 'Admin Two', email: 'admintwo@example.com' },
  ]);
  const [newAdmin, setNewAdmin] = useState({ name: '', email: '' });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNewAdmin({ ...newAdmin, [name]: value });
  };

  const handleCreateAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!newAdmin.name || !newAdmin.email) {
      setError('All fields are required!');
      return;
    }

    // Simulate API call to create an admin
    setAdmins([
      ...admins,
      { id: admins.length + 1, name: newAdmin.name, email: newAdmin.email },
    ]);

    setNewAdmin({ name: '', email: '' });
  };

  const handleDeleteAdmin = (id: number) => {
    setAdmins(admins.filter(admin => admin.id !== id));
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <h1 className="text-4xl font-bold mb-8 text-center">Super Admin Dashboard</h1>

      {/* Create Admin Form */}
      <div className="bg-gray-800 p-6 rounded-lg shadow-lg mb-8">
        <h2 className="text-2xl font-semibold mb-4">Create Admin Account</h2>
        {error && <p className="text-red-500">{error}</p>}
        <form onSubmit={handleCreateAdmin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium">Name</label>
            <input
              type="text"
              name="name"
              value={newAdmin.name}
              onChange={handleInputChange}
              className="w-full px-4 py-2 border rounded-md bg-gray-700"
              placeholder="Enter name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Email</label>
            <input
              type="email"
              name="email"
              value={newAdmin.email}
              onChange={handleInputChange}
              className="w-full px-4 py-2 border rounded-md bg-gray-700"
              placeholder="Enter email"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-blue-500 text-white py-2 rounded-md hover:bg-blue-600 transition"
          >
            Create Admin
          </button>
        </form>
      </div>

      {/* Admin List */}
      <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
        <h2 className="text-2xl font-semibold mb-4">Admin Accounts</h2>
        <table className="min-w-full text-left table-auto">
          <thead>
            <tr>
              <th className="px-4 py-2">ID</th>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {admins.map(admin => (
              <tr key={admin.id}>
                <td className="px-4 py-2">{admin.id}</td>
                <td className="px-4 py-2">{admin.name}</td>
                <td className="px-4 py-2">{admin.email}</td>
                <td className="px-4 py-2">
                  <button
                    onClick={() => handleDeleteAdmin(admin.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SadminDashboard;
