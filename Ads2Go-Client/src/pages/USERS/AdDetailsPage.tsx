// src/pages/AdDetailsPage.tsx
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Bell, CheckCircle, Truck, Trophy, XCircle } from 'lucide-react'; // Import additional icons for notifications
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from 'recharts';

// Ad type (should be consistent across files)
type Ad = {
  id: number;
  title: string;
  riders: number;
  desc: string;
  date: string;
  price: number;
  status: 'Pending' | 'Dispatch' | 'Completed';
  vehicleType: 'Car' | 'Motor' | 'Jeep' | 'Bus';
  material: 'LCD Screen' | 'Posters' | 'Vinyl Sticker';
  plan: 'Monthly' | 'Weekly';
  format: 'Image' | 'Video';
  imagePath?: string;
};

// Type for notifications
type Notification = {
  id: number;
  riderName: string;
  type: 'avail' | 'on_the_move' | 'completed' | 'cancelled';
  timestamp: string;
};

// Sample ad data (In a real app, this would be fetched from an API)
const sampleAds: Ad[] = [
  { id: 2632, title: 'Drive Clean Promo', riders: 5, desc: 'Promoting a sleek car wash service in Manila', date: '31 Jul 2020', price: 64.00, status: 'Pending', vehicleType: 'Car', material: 'LCD Screen', plan: 'Monthly', format: 'Image', imagePath: '/image/blue-logo.png' },
  { id: 2633, title: 'Urban Threads Campaign', riders: 67, desc: 'Launching a streetwear campaign across Cebu', date: '01 Aug 2020', price: 35.00, status: 'Dispatch', vehicleType: 'Motor', material: 'Posters', plan: 'Weekly', format: 'Video', imagePath: '/image/duck.gif' },
  { id: 2634, title: 'Fresh Harvest Tour', riders: 10, desc: 'Highlighting local farm produce in Quezon City', date: '02 Aug 2020', price: 74.00, status: 'Completed', vehicleType: 'Jeep', material: 'Vinyl Sticker', plan: 'Monthly', format: 'Image', imagePath: '/image/black-logo.png' },
  { id: 2635, title: 'Beach Bliss Offers', riders: 3, desc: 'Summer promo for beachfront resort in Batangas', date: '02 Aug 2020', price: 82.00, status: 'Pending', vehicleType: 'Bus', material: 'LCD Screen', plan: 'Weekly', format: 'Video', imagePath: '/image/cat.avif' },
  { id: 2636, title: 'eRide Makati Launch', riders: 8, desc: 'Promoting electric vehicle rentals in Makati', date: '03 Aug 2020', price: 38.00, status: 'Dispatch', vehicleType: 'Car', material: 'Posters', plan: 'Monthly', format: 'Image', imagePath: '/image/large.jpg' },
  { id: 2637, title: 'GlowUp Skincare Push', riders: 15, desc: 'Introducing a new skincare brand to college students', date: '03 Aug 2020', price: 67.00, status: 'Completed', vehicleType: 'Motor', material: 'Vinyl Sticker', plan: 'Weekly', format: 'Video', imagePath: '/image/neko.webp'},
  { id: 2638, title: 'TechArmor Mobile Blast', riders: 15, desc: 'Promoting mobile accessories in high-traffic areas', date: '03 Aug 2020', price: 67.00, status: 'Pending', vehicleType: 'Motor', material: 'Vinyl Sticker', plan: 'Weekly', format: 'Video' },
  { id: 2639, title: 'Campus Reads Promo', riders: 15, desc: 'Back-to-school campaign for local bookstore chain', date: '03 Aug 2020', price: 67.00, status: 'Completed', vehicleType: 'Motor', material: 'Vinyl Sticker', plan: 'Weekly', format: 'Video' },
  { id: 2640, title: 'StartUp Spark PH', riders: 15, desc: 'Advert for tech startup launching in Metro Manila', date: '03 Aug 2020', price: 67.00, status: 'Dispatch', vehicleType: 'Motor', material: 'Vinyl Sticker', plan: 'Weekly', format: 'Video' },
  { id: 2641, title: 'CareClinic Awareness Ride', riders: 15, desc: 'Health awareness campaign for a local clinic', date: '03 Aug 2020', price: 67.00, status: 'Dispatch', vehicleType: 'Motor', material: 'Vinyl Sticker', plan: 'Weekly', format: 'Video' },
  { id: 2642, title: 'FlexFit Ad Rollout', riders: 15, desc: 'Promoting a fitness app for on-the-go workouts', date: '03 Aug 2020', price: 67.00, status: 'Pending', vehicleType: 'Motor', material: 'Vinyl Sticker', plan: 'Weekly', format: 'Video' },
];

// Sample notification data
const sampleNotifications: Notification[] = [
  { id: 1, riderName: 'Jose Pascual', type: 'avail', timestamp: '2024-07-20 10:00 AM' },
  { id: 2, riderName: 'Maria Santos', type: 'on_the_move', timestamp: '2024-07-20 10:15 AM' },
  { id: 3, riderName: 'Jose Pascual', type: 'completed', timestamp: '2024-07-20 11:30 AM' },
  { id: 4, riderName: 'Pedro Cruz', type: 'avail', timestamp: '2024-07-20 11:45 AM' },
  { id: 5, riderName: 'Maria Santos', type: 'cancelled', timestamp: '2024-07-20 12:00 PM' },
  { id: 6, riderName: 'Juan Dela Cruz', type: 'avail', timestamp: '2024-07-20 01:30 PM' },
  { id: 7, riderName: 'Rica Reyes', type: 'on_the_move', timestamp: '2024-07-20 02:00 PM' },
  { id: 8, riderName: 'Crispin Garcia', type: 'completed', timestamp: '2024-07-20 03:00 PM' },
];

// Utility function to mask the name
const maskName = (fullName: string): string => {
  const parts = fullName.split(' ');
  if (parts.length === 0) return '';

  const maskedParts = parts.map((part, index) => {
    if (part.length <= 1) return part; // Don't mask single character parts (e.g., "A")

    if (index === 0) { // First name masking (e.g., "Jose" -> "Jo**")
      if (part.length <= 2) return part; // Names like "Jo" remain "Jo"
      return part.substring(0, 2) + '*'.repeat(part.length - 2);
    } else { // Subsequent names (e.g., last name: "Pascual" -> "P***al")
      // This is a specific masking pattern based on the example
      if (part.length < 3) { // For names like "Li" (2 chars)
          return part.substring(0, 1) + '*'.repeat(part.length - 1); // "Li" -> "L*"
      }
      if (part.length === 3) { // For names like "Lee" (3 chars)
          return part.substring(0, 1) + '**'; // "Lee" -> "L**"
      }
      // For names 4 chars or longer, apply the "P***al" style
      // First char + fixed 3 asterisks + last 2 chars
      const firstChar = part.substring(0, 1);
      const lastTwoChars = part.substring(part.length - 2);
      return firstChar + '***' + lastTwoChars; // Hardcoding 3 asterisks
    }
  });
  return maskedParts.join(' ');
};

// Helper function to generate notification text
const getNotificationText = (notification: Notification) => {
  const maskedRiderName = maskName(notification.riderName); // Mask the rider's name
  switch (notification.type) {
    case 'avail':
      return `Rider ${maskedRiderName} has availed this ad.`;
    case 'on_the_move':
      return `Rider ${maskedRiderName} is on the move.`;
    case 'completed':
      return `Rider ${maskedRiderName} has completed the ad task.`;
    case 'cancelled':
      return `Rider ${maskedRiderName} cancelled the ad task.`;
    default:
      return '';
  }
};


const AdDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const adId = parseInt(id || '', 10);
  const ad = sampleAds.find(a => a.id === adId);

  // State for selected period filter (for chart)
  const [selectedPeriod, setSelectedPeriod] = useState<'Weekly' | 'Daily'>('Daily');
  // State for active tab
  const [activeTab, setActiveTab] = useState<'Details' | 'AdActivity'>('Details');


  const handlePeriodChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedPeriod(event.target.value as 'Weekly' | 'Daily');
  };

  if (!ad) {
    return (
      <div className="flex-1 ml-60 p-6 bg-gray-100 h-screen flex items-center justify-center">
        <div className="text-center text-gray-700">
          <h1 className="text-3xl font-bold mb-4">Ad Not Found</h1>
          <p className="mb-6">The advertisement you are looking for does not exist.</p>
          <button
            onClick={() => navigate('/advertisements')}
            className="px-6 py-3 bg-[#3674B5] text-white rounded-lg hover:bg-[#578FCA] transition-colors flex items-center justify-center mx-auto"
          >
            <ChevronLeft size={20} className="mr-2" /> Back to Advertisements
          </button>
        </div>
      </div>
    );
  }

  // Function to generate mock profit data based on selected period
  const getChartData = () => {
    const baseProfit = ad.price * 0.7; // Assume profit is 70% of the price for demonstration
    const data = [];

    switch (selectedPeriod) {
      case 'Daily':
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        for (let i = 0; i < 7; i++) {
          const profitVariation = (Math.random() - 0.5) * (baseProfit * 0.2); // +/- 10% variation
          data.push({ day: days[i], profit: parseFloat((baseProfit + profitVariation).toFixed(2)) });
        }
        break;
      case 'Weekly':
        for (let i = 1; i <= 5; i++) { // 5 weeks of data
          const profitVariation = (Math.random() - 0.5) * (baseProfit * 0.3); // +/- 15% variation
          data.push({ week: `Week ${i}`, profit: parseFloat((baseProfit * 4 + profitVariation).toFixed(2)) }); // Scale for weekly
        }
        break;
    }
    return data;
  };

  return (
    <div className="min-h-screen bg-gray-100 ml-60">

      <div className="bg-gray-100 rounded-lg p-8 grid grid-cols-2 gap-8">
        {/* LEFT Section (Details, Description, Price, Profit Chart / Notifications) */}
        <div className="flex flex-col space-y-8">
          {/* Back button moved here, above the status and title */}
          <button
            onClick={() => navigate('/advertisements')}
            className="py-2 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors flex items-center mb-4" // Added mb-4 for spacing
          >
            <ChevronLeft size={20} className="mr-2" /> Back to Advertisements
          </button>
          
          <div>
            <span className={`inline-block px-3 py-1 text-sm font-semibold rounded-full ${ad.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' : ad.status === 'Dispatch' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
              {ad.status}
            </span>
            <h2 className="text-5xl font-bold mt-4 mb-2">{ad.title}</h2>
            <p className="text-3xl text-gray-800 font-semibold">${ad.price.toFixed(2)}</p>
            <p className="text-md text-gray-600">{ad.plan} plan</p>          
            <p className="text-md font-bold text-gray-600">Until {ad.date}</p>

            <p className="text-gray-700 mt-6 text-lg leading-relaxed">{ad.desc}</p>
          </div>

          {/* Tabs - simplified for ad details */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('Details')}
                className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'Details'
                    ? 'border-[#1b5087] text-[#1b5087]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Details
              </button>
              <button
                onClick={() => setActiveTab('AdActivity')}
                className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'AdActivity'
                    ? 'border-[#1b5087] text-[#1b5087]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Ad Activity
              </button>
            </nav>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-4 mt-6 justify-end">
            {/* Payment Button - only for Pending ads */}
            {ad.status === 'Pending' && (
              <button
                onClick={() => navigate('/payment')}
                className="px-6 py-3 bg-none border border-[#1b5087] text-[#1b5087] rounded-xl font-semibold hover:bg-[#EFEEEA] transition-colors shadow"
              >
                Payment
              </button>
            )}
            <button
              onClick={() => {
                alert(`Deleting ad ${ad.id}`);
                navigate('/advertisements'); // Navigate back after mock delete
              }}
              className="ml-auto px-6 py-3 border border-red-300 text-red-600 rounded-xl font-semibold hover:bg-red-50 transition-colors shadow"
            >
              Delete Ad
            </button>
          </div>

          {/* Conditionally rendered content based on activeTab */}
          {activeTab === 'Details' ? (
            // Profit Chart
            <div className="bg-white rounded-3xl p-6 shadow-md">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl text-black font-semibold">Profit Overview</h3>
                <div className="relative">
                  <select
                    className="text-xs text-black bg-none rounded-3xl pl-5 pr-10 py-3 border border-black focus:outline-none appearance-none"
                    value={selectedPeriod}
                    onChange={handlePeriodChange}
                  >
                    <option className="rounded-3xl" value="Weekly">Weekly</option>
                    <option className="rounded-3xl" value="Daily">Daily</option>
                  </select>
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                    <svg className="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={150}>
                <AreaChart data={getChartData()} margin={{ top: 10, right: 0, left: 0, bottom: 20 }}>
                  <XAxis
                    dataKey={selectedPeriod === 'Daily' ? 'day' : selectedPeriod === 'Weekly' ? 'week' : 'month'} // Dynamic dataKey
                    axisLine={false}
                    tickLine={false}
                    stroke="black" 
                    tick={{ fontSize: 10 }}
                    interval="preserveStartEnd"
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#2D3748', border: 'none', borderRadius: '8px' }}
                    labelStyle={{ color: '#E2E8F0' }}
                    itemStyle={{ color: '#A8FF35' }}
                    formatter={(value: number) => `$${value.toFixed(2)}`} 
                  />
                  <Area
                    type="monotone"
                    dataKey="profit"
                    stroke="#A8FF35"
                    fill="#0E2A47" 
                    fillOpacity={0.6}
                    name="Profit"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            // Ad Activity Notifications
            <div className="bg-none rounded-lg">
              <h3 className="text-xl font-semibold mb-4 pl-6 text-gray-800">Ad Activity Notifications</h3>
              <div className="space-y-2 max-h-80 p-3 overflow-y-auto custom-scrollbar">
                {sampleNotifications.map(notif => (
                  <div key={notif.id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg shadow-md">
                    {/* Icon based on notification type */}
                    {notif.type === 'avail' && <CheckCircle size={20} className="text-green-500 flex-shrink-0 mt-0.5" />}
                    {notif.type === 'on_the_move' && <Truck size={20} className="text-blue-500 flex-shrink-0 mt-0.5" />}
                    {notif.type === 'completed' && <Trophy size={20} className="text-purple-500 flex-shrink-0 mt-0.5" />}
                    {notif.type === 'cancelled' && <XCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />}
                    <div className="flex-1">
                      <p className="text-[#1b5087] text-sm font-medium">{getNotificationText(notif)}</p>
                      <p className="text-gray-500 text-xs">{notif.timestamp}</p>
                    </div>
                  </div>
                ))}
                {sampleNotifications.length === 0 && (
                  <p className="text-center text-gray-500 py-10">No activities found for this ad.</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT Section (Media, Properties, Levels, Stats) */}
        <div className="flex flex-col space-y-8">
          {/* Main Media Display */}
          <div className="rounded-xl overflow-hidden bg-gray-200 flex items-center justify-center" style={{ height: '400px' }}>
            {ad.format === 'Video' && ad.imagePath ? (
              <video src={ad.imagePath} controls className="w-full h-full object-contain"></video>
            ) : ad.imagePath ? (
              <img src={ad.imagePath} alt={ad.title} className="w-full h-full object-contain" />
            ) : (
              <div className="text-gray-500 text-xl">No Media Available</div>
            )}
          </div>

          {/* Properties Section */}
          <div className="bg-gray-50 rounded-lg p-6 shadow-md">
            <h3 className="text-xl font-semibold mb-4">Properties</h3>
            <div className="grid grid-cols-2 gap-4">
              <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium text-center">Vehicle: {ad.vehicleType}</span>
              <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium text-center">Material: {ad.material}</span>
              <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-medium text-center">Plan: {ad.plan}</span>
              <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium text-center">Format: {ad.format}</span>
            </div>
          </div>

          {/* Levels Section (Adapted for Ad context - e.g., Rider Count) */}
          <div className="bg-gray-50 rounded-lg p-6 shadow-md">
            <h3 className="text-xl font-semibold mb-4">Ad Performance (Example)</h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-gray-700">Riders Allocated: {ad.riders}</p>
                <div className="w-full bg-gray-200 rounded-full h-2.5 mt-1">
                  <div className="bg-[#1b5087] h-2.5 rounded-full" style={{ width: `${Math.min(100, (ad.riders / 100) * 100)}%` }}></div> {/* Assuming max 100 riders for progress bar */}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Engagement Score: {(Math.random() * 100).toFixed(0)}%</p>
                <div className="w-full bg-gray-200 rounded-full h-2.5 mt-1">
                  <div className="bg-green-600 h-2.5 rounded-full" style={{ width: `${(Math.random() * 100).toFixed(0)}%` }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdDetailsPage;