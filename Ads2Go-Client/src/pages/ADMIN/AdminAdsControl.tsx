import React, { useState } from 'react';
import { PlayIcon, PauseIcon } from '@heroicons/react/24/solid';

interface Ad {
  id: string;
  title: string;
  vehicleType: string;
  status: 'Playing' | 'Paused';
  duration: string;
  thumbnail: string;
}

const lcdVehicleTypes = ['Car', 'Motorcycle', 'Electric Tricycle'];

const mockAds: Ad[] = [
  {
    id: 'A1',
    title: 'Cement Sale Promo',
    vehicleType: 'Car',
    status: 'Playing',
    duration: '30s',
    thumbnail: '/thumbnails/ad1.jpg',
  },
  {
    id: 'A2',
    title: 'New Gravel Supplier',
    vehicleType: 'Motorcycle',
    status: 'Paused',
    duration: '45s',
    thumbnail: '/thumbnails/ad2.jpg',
  },
  {
    id: 'A3',
    title: 'Construction Insurance',
    vehicleType: 'Electric Tricycle',
    status: 'Playing',
    duration: '60s',
    thumbnail: '/thumbnails/ad3.jpg',
  },
];

const AdminAdsControl: React.FC = () => {
  const [ads, setAds] = useState<Ad[]>(
    mockAds.filter((ad) => lcdVehicleTypes.includes(ad.vehicleType))
  );
  const [mode, setMode] = useState<'centralized' | 'individual'>('individual');
  const [centralAdId, setCentralAdId] = useState<string>(ads[0]?.id || '');

  const toggleAdStatus = (id: string) => {
    setAds((prev) =>
      prev.map((ad) =>
        ad.id === id
          ? { ...ad, status: ad.status === 'Playing' ? 'Paused' : 'Playing' }
          : ad
      )
    );
  };

  const centralAd = ads.find((ad) => ad.id === centralAdId);

  return (
    <div className="p-8 bg-gray-900 min-h-screen text-white">
      <h1 className="text-2xl font-bold mb-6">Ad Control Panel - LCD Equipped</h1>

      {/* Mode Switcher */}
      <div className="mb-6 flex items-center gap-4">
        <label className="flex items-center space-x-2">
          <input
            type="radio"
            name="mode"
            value="individual"
            checked={mode === 'individual'}
            onChange={() => setMode('individual')}
          />
          <span>Individual Control</span>
        </label>
        <label className="flex items-center space-x-2">
          <input
            type="radio"
            name="mode"
            value="centralized"
            checked={mode === 'centralized'}
            onChange={() => setMode('centralized')}
          />
          <span>Centralized Control</span>
        </label>
      </div>

      {mode === 'centralized' ? (
        <div className="space-y-4">
          <label className="block text-sm mb-2 font-medium">
            Select Ad for All LCD Vehicles
          </label>
          <select
            value={centralAdId}
            onChange={(e) => setCentralAdId(e.target.value)}
            className="w-full p-2 bg-gray-800 border border-gray-600 rounded"
          >
            {ads.map((ad) => (
              <option key={ad.id} value={ad.id}>
                {ad.title} ({ad.duration})
              </option>
            ))}
          </select>

          {centralAd && (
            <div className="bg-gray-800 rounded-lg shadow-md overflow-hidden mt-4">
              <img
                src={centralAd.thumbnail}
                alt={centralAd.title}
                className="w-full h-48 object-cover"
              />
              <div className="p-4 flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-bold">{centralAd.title}</h2>
                  <p className="text-sm text-gray-400">{centralAd.vehicleType}</p>
                  <p className="text-sm">Duration: {centralAd.duration}</p>
                </div>
                <span className="text-sm px-3 py-1 bg-green-600 rounded-full">Playing</span>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {ads.map((ad) => (
            <div
              key={ad.id}
              className="bg-gray-800 rounded-lg overflow-hidden shadow-md flex flex-col"
            >
              <img
                src={ad.thumbnail}
                alt={ad.title}
                className="w-full h-40 object-cover"
              />
              <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
                <div>
                  <h2 className="text-lg font-semibold">{ad.title}</h2>
                  <p className="text-sm text-gray-400">{ad.vehicleType}</p>
                  <p className="text-sm">Duration: {ad.duration}</p>
                </div>
                <div className="flex justify-between items-center mt-4">
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      ad.status === 'Playing'
                        ? 'bg-green-600'
                        : 'bg-yellow-600'
                    }`}
                  >
                    {ad.status}
                  </span>
                  <button
                    onClick={() => toggleAdStatus(ad.id)}
                    className={`p-2 rounded-full ${
                      ad.status === 'Playing'
                        ? 'bg-yellow-500 hover:bg-yellow-600'
                        : 'bg-green-500 hover:bg-green-600'
                    }`}
                  >
                    {ad.status === 'Playing' ? (
                      <PauseIcon className="w-5 h-5 text-white" />
                    ) : (
                      <PlayIcon className="w-5 h-5 text-white" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminAdsControl;
