import React from 'react';
import adminBackground from '../../assets/images/admin/adminbackround.webp';
import {
  PieChart, Pie, Cell, Tooltip, Legend,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  BarChart, Bar, ResponsiveContainer,
} from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

const userRoleData = [
  { name: 'Admins', value: 10 },
  { name: 'Clients', value: 60 },
  { name: 'Drivers', value: 30 },
];

const adPerformanceData = [
  { month: 'Jan', impressions: 6000, qrScans: 200 },
  { month: 'Feb', impressions: 7500, qrScans: 250 },
  { month: 'Mar', impressions: 7200, qrScans: 230 },
  { month: 'Apr', impressions: 8500, qrScans: 300 },
  { month: 'May', impressions: 8200, qrScans: 310 },
  { month: 'Jun', impressions: 10500, qrScans: 350 },
  { month: 'Jul', impressions: 11500, qrScans: 370 },
  { month: 'Aug', impressions: 12000, qrScans: 390 },
  { month: 'Sep', impressions: 11000, qrScans: 360 },
];

const ctrData = [
  { campaign: 'Coffee Shop', ctr: 3 },
  { campaign: 'Fitness Gym', ctr: 4.2 },
  { campaign: 'Fashion', ctr: 3.6 },
  { campaign: 'Tech Expo', ctr: 2.1 },
  { campaign: 'Food Truck', ctr: 2.9 },
];

const vehicleData = [
  { id: 'ADS-V001', driver: 'John Smith', ad: 'Coffee Shop Promo', speed: '51 km/h', distance: '85.1 km', status: 'Active', location: 'View on map' },
  { id: 'ADS-V002', driver: 'Emma Wilson', ad: 'Summer Festival', speed: '32 km/h', distance: '98.9 km', status: 'Active', location: 'View on map' },
  { id: 'ADS-V003', driver: 'Michael Chen', ad: 'New Restaurant Opening', speed: '0 km/h', distance: '64.3 km', status: 'Parked', location: 'View on map' },
  { id: 'ADS-V004', driver: 'Sarah Johnson', ad: 'Tech Conference', speed: '57 km/h', distance: '92.3 km', status: 'Active', location: 'View on map' },
  { id: 'ADS-V005', driver: 'David Brown', ad: 'Fitness Gym Offer', speed: '0 km/h', distance: '0 km', status: 'Offline', location: 'Not available' },
];

const AdminDashboard: React.FC = () => {
  return (
    <div className="min-h-screen bg-cover bg-center" style={{ backgroundImage: `url(${adminBackground})` }}>
      <div className="bg-black bg-opacity-60 min-h-screen p-8 text-white">
        <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>

        <div className="bg-gray-900 p-6 rounded-lg mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Recent Notifications</h2>
            <span className="text-blue-400 text-sm cursor-pointer hover:underline">View all</span>
          </div>
          <ul className="space-y-4 text-sm">
            <li className="bg-gray-800 p-4 rounded">
              <p className="font-semibold text-yellow-400">Low engagement alert: "Summer Festival" campaign</p>
              <p className="text-gray-300">QR scan rate is 42% below average. Consider repositioning or changing creative.</p>
              <p className="text-gray-500 text-xs mt-1">10 minutes ago</p>
            </li>
            <li className="bg-gray-800 p-4 rounded">
              <p className="font-semibold text-green-400">New ad approved: "Coffee Shop Promo"</p>
              <p className="text-gray-300">The advertisement has been approved and is now active on 5 vehicles.</p>
              <p className="text-gray-500 text-xs mt-1">1 hour ago</p>
            </li>
            <li className="bg-gray-800 p-4 rounded">
              <p className="font-semibold text-blue-400">New client registered: "Tech Solutions Inc."</p>
              <p className="text-gray-300">A new client has registered and is ready to create their first campaign.</p>
              <p className="text-gray-500 text-xs mt-1">3 hours ago</p>
            </li>
          </ul>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
          <div className="bg-gray-800 p-6 rounded shadow">
            <h2 className="text-xl font-semibold">Total Ads</h2>
            <p className="text-3xl mt-2">128</p>
          </div>
          <div className="bg-gray-800 p-6 rounded shadow">
            <h2 className="text-xl font-semibold">Active Ads</h2>
            <p className="text-3xl mt-2">84</p>
          </div>
          <div className="bg-gray-800 p-6 rounded shadow">
            <h2 className="text-xl font-semibold">Pending Ads</h2>
            <p className="text-3xl mt-2">12</p>
          </div>
          <div className="bg-gray-800 p-6 rounded shadow">
            <h2 className="text-xl font-semibold">Total QR Scans</h2>
            <p className="text-3xl mt-2">3,521</p>
          </div>
        </div>

        <div className="bg-gray-900 p-6 rounded-lg mb-10">
          <h2 className="text-xl font-bold mb-4">User Role Distribution</h2>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={userRoleData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                {userRoleData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          <div className="bg-gray-900 p-6 rounded-lg">
            <h2 className="text-xl font-bold mb-4">Ad Performance</h2>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={adPerformanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="impressions" stroke="#8884d8" />
                <Line type="monotone" dataKey="qrScans" stroke="#82ca9d" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-gray-900 p-6 rounded-lg">
            <h2 className="text-xl font-bold mb-4">CTR by Campaign</h2>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={ctrData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="campaign" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="ctr" fill="#3498db" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          <div className="bg-gray-900 p-6 rounded-lg">
            <h2 className="text-xl font-bold mb-4">Driver Compensation Overview</h2>
            <ul className="list-disc pl-5 space-y-2 text-sm">
              <li>Base Pay: 60%</li>
              <li>Ad View Bonus: 25%</li>
              <li>QR Code Scan Bonus: 15%</li>
            </ul>
          </div>

          <div className="bg-gray-900 p-6 rounded-lg">
            <h2 className="text-xl font-bold mb-4">Vehicle Coverage Map</h2>
            <div className="w-full h-40 bg-gray-700 flex items-center justify-center rounded">
              <span className="text-sm text-gray-300">Map Placeholder</span>
            </div>
          </div>
        </div>

        <div className="bg-gray-900 p-6 rounded-lg mb-10 overflow-auto">
          <h2 className="text-xl font-bold mb-4">Live Vehicle Tracking</h2>
          <p className="text-sm text-green-400 mb-2">3 Active</p>
          <table className="table-auto w-full text-sm text-left">
            <thead>
              <tr className="bg-gray-800 text-white">
                <th className="px-4 py-2">Vehicle ID</th>
                <th className="px-4 py-2">Driver</th>
                <th className="px-4 py-2">Current Ad</th>
                <th className="px-4 py-2">Speed</th>
                <th className="px-4 py-2">Distance Today</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Location</th>
              </tr>
            </thead>
            <tbody>
              {vehicleData.map((vehicle) => (
                <tr key={vehicle.id} className="border-b border-gray-700 hover:bg-gray-800">
                  <td className="px-4 py-2">{vehicle.id}</td>
                  <td className="px-4 py-2">{vehicle.driver}</td>
                  <td className="px-4 py-2">{vehicle.ad}</td>
                  <td className="px-4 py-2">{vehicle.speed}</td>
                  <td className="px-4 py-2">{vehicle.distance}</td>
                  <td className="px-4 py-2">{vehicle.status}</td>
                  <td className="px-4 py-2">{vehicle.location}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-yellow-600 p-4 rounded-lg text-black text-center">
          <p className="text-xl font-semibold">📌 You have 12 ads pending approval!</p>
        </div>

        <div className="bg-gray-900 p-6 rounded-lg mb-10">
          <h2 className="text-xl font-bold mb-4">Ads Pending Approval</h2>
          <p className="text-sm text-yellow-400 mb-4">3 Pending</p>
          <div className="overflow-auto">
            <table className="table-auto w-full text-sm text-left text-white">
              <thead>
                <tr className="bg-gray-800">
                  <th className="px-4 py-2">Ad Name</th>
                  <th className="px-4 py-2">Client</th>
                  <th className="px-4 py-2">Submitted</th>
                  <th className="px-4 py-2">Type</th>
                  <th className="px-4 py-2">Preview</th>
                  <th className="px-4 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {[{ name: 'Summer Sale Promotion', client: 'Fashion Store Inc.', submitted: '2 hours ago', type: 'Digital Banner' },
                  { name: 'Grand Opening Event', client: 'New Cafe Co.', submitted: '6 hours ago', type: 'Full Wrap' },
                  { name: 'Weekend Deal Alert', client: 'Electronics World', submitted: '1 day ago', type: 'Digital Banner' }]
                  .map((ad, index) => (
                    <tr key={index} className="border-b border-gray-700 hover:bg-gray-800">
                      <td className="px-4 py-2">{ad.name}</td>
                      <td className="px-4 py-2">{ad.client}</td>
                      <td className="px-4 py-2">{ad.submitted}</td>
                      <td className="px-4 py-2">{ad.type}</td>
                      <td className="px-4 py-2 text-blue-400 cursor-pointer">View</td>
                      <td className="px-4 py-2 space-x-2">
                        <button className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs">Approve</button>
                        <button className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-xs">Reject</button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            <div className="mt-4 text-right text-blue-400 cursor-pointer hover:underline">View all pending ads →</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
