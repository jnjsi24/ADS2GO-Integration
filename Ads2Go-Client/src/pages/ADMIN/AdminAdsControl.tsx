import React, { useState, useRef, useEffect } from 'react';
import { PlayIcon, PauseIcon } from '@heroicons/react/24/solid';

interface Ad {
  id: string;
  title: string;
  vehicleType: string;
  status: 'Playing' | 'Paused';
  duration: string;
  mediaSrc: string; // Changed from 'thumbnail' to 'mediaSrc'
}

const lcdVehicleTypes = ['Car', 'Motorcycle', 'Electric Tricycle'];

const mockAds: Ad[] = [
  {
    id: 'A1',
    title: 'Cement Sale Promo',
    vehicleType: 'Car',
    status: 'Playing',
    duration: '30s',
    mediaSrc: '/image/cat.avif',
  },
  {
    id: 'A2',
    title: 'New Gravel Supplier',
    vehicleType: 'Motorcycle',
    status: 'Paused',
    duration: '45s',
    mediaSrc: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4', // Sample MP4 video
  },
  {
    id: 'A3',
    title: 'Construction Insurance',
    vehicleType: 'Electric Tricycle',
    status: 'Playing',
    duration: '60s',
    mediaSrc: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4', // Sample MP4 video
  },
];

const AdminAdsControl: React.FC = () => {
  const [ads, setAds] = useState<Ad[]>(
    mockAds.filter((ad) => lcdVehicleTypes.includes(ad.vehicleType))
  );
  const [mode, setMode] = useState<'centralized' | 'individual'>('individual');
  const [centralAdId, setCentralAdId] = useState<string>(ads[0]?.id || '');

  // Ref to store video elements for programmatic control
  const videoRefs = useRef<Map<string, HTMLVideoElement | null>>(new Map());

  // Effect to manage video playback based on ad status
  useEffect(() => {
    ads.forEach(ad => {
      const videoElement = videoRefs.current.get(ad.id);
      if (videoElement) {
        if (ad.status === 'Playing') {
          // Play only if not already playing and ready
          if (videoElement.paused) {
            videoElement.play().catch(error => console.error("Error playing video:", error));
          }
        } else {
          // Pause only if not already paused
          if (!videoElement.paused) {
            videoElement.pause();
          }
        }
      }
    });
  }, [ads]); // Re-run when ads state changes

  const toggleAdStatus = (id: string) => {
    setAds((prev) =>
      prev.map((ad) => {
        if (ad.id === id) {
          const newStatus = ad.status === 'Playing' ? 'Paused' : 'Playing';
          const videoElement = videoRefs.current.get(ad.id);
          if (videoElement) {
            if (newStatus === 'Playing') {
              videoElement.play().catch(error => console.error("Error playing video:", error));
            } else {
              videoElement.pause();
            }
          }
          return { ...ad, status: newStatus };
        }
        return ad;
      })
    );
  };

  const centralAd = ads.find((ad) => ad.id === centralAdId);

  // Helper function to render media (video or image)
  const renderMedia = (ad: Ad, isCompact: boolean = false) => {
    const isVideo = /\.(mp4|webm|ogg|gif)$/i.test(ad.mediaSrc);
    const mediaClassName = isCompact ? "w-20 h-16 object-cover rounded-lg" : "w-full h-40 object-cover";

    if (isVideo) {
      return (
        <video
          src={ad.mediaSrc}
          className={mediaClassName}
          loop // Loop the video
          muted // Mute the video to allow autoplay in most browsers
          playsInline // Important for iOS devices
          controls={false} // Hide native controls, as we have our own play/pause button
          ref={(el) => videoRefs.current.set(ad.id, el)} // Store ref
        >
          Your browser does not support the video tag.
        </video>
      );
    } else {
      // Fallback to image if it's not a recognized video format
      return (
        <img
          src={ad.mediaSrc}
          alt={ad.title}
          className={mediaClassName}
        />
      );
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#2E2E2E] pl-72">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-[#0A192F] pt-10">Ad Control Panel</h1>
      </div>

      <div className="flex">
        <button
          className={`px-6 py-3 font-medium text-sm transition-all duration-300 ${
            mode === 'individual'
              ? 'text-[#0A192F] border-b-2 border-[#3674B5]'
              : 'text-[#7A7A7A] hover:text-[#2E2E2E]'
          }`}
          onClick={() => setMode('individual')}
        >
          Individual Control
        </button>
        <button
          className={`px-6 py-3 font-medium text-sm transition-all duration-300 ${
            mode === 'centralized'
              ? 'text-[#0A192F] border-b-2 border-[#3674B5]'
              : 'text-[#7A7A7A] hover:text-[#2E2E2E]'
          }`}
          onClick={() => setMode('centralized')}
        >
          Centralized Control
        </button>
      </div>

      <div className="p-6">
        {mode === 'centralized' ? (
          <div className="space-y-6">
            <div className="p-6 rounded-xl transition-colors duration-300">
              <h2 className="text-lg font-semibold mb-4 text-[#0A192F]">Centralized Ad Control</h2>

              <div className="mb-6">
                <label className="block text-sm font-medium text-[#2E2E2E] mb-2">
                  Select Ad for All Vehicles
                </label>
                <div className="relative">
                  <select
                    value={centralAdId}
                    onChange={(e) => setCentralAdId(e.target.value)}
                    className="w-full p-3 bg-white border border-[#E0E0E0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3674B5] focus:border-[#3674B5] transition-colors duration-300 appearance-none"
                  >
                    {ads.map((ad) => (
                      <option key={ad.id} value={ad.id}>
                        {ad.title} ({ad.duration})
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[#2E2E2E]">
                    <svg
                      className="fill-current h-4 w-4"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                    </svg>
                  </div>
                </div>
              </div>

              {centralAd && (
                <div className="space-y-4">
                  <h3 className="text-md font-medium text-[#2E2E2E]">Currently Playing:</h3>
                  <div className="flex items-center p-4 bg-[#FAFAFA] rounded-lg border border-[#E0E0E0] transition-colors duration-300">
                    {renderMedia(centralAd, true)} {/* Use renderMedia for compact display */}
                    <div className="ml-4 flex-1">
                      <h4 className="font-medium text-[#0A192F]">{centralAd.title}</h4>
                      <p className="text-sm text-[#7A7A7A]">
                        {centralAd.vehicleType} • {centralAd.duration}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span
                        className={`text-xs px-3 py-1 rounded-full font-medium ${
                          centralAd.status === 'Playing'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {centralAd.status}
                      </span>
                      <button
                        onClick={() => toggleAdStatus(centralAd.id)}
                        className={`p-2 rounded-full transition-colors duration-200 ${
                          centralAd.status === 'Playing'
                            ? 'bg-[#3674B5] hover:bg-[#0A192F]'
                            : 'bg-[#3674B5] hover:bg-[#0A192F]'
                        }`}
                      >
                        {centralAd.status === 'Playing' ? (
                          <PauseIcon className="w-5 h-5 text-white" />
                        ) : (
                          <PlayIcon className="w-5 h-5 text-white" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div>
            <h2 className="text-lg font-semibold mb-4 text-[#0A192F]">Individual Ad Controls</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {ads.map((ad) => (
                <div
                  key={ad.id}
                  className="bg-white rounded-xl shadow-sm border border-[#E0E0E0] overflow-hidden transition-all duration-300 hover:shadow-md"
                >
                  {renderMedia(ad)} {/* Use renderMedia for full-size display */}
                  <div className="p-4">
                    <h3 className="font-medium text-[#0A192F]">{ad.title}</h3>
                    <p className="text-sm text-[#7A7A7A] mt-1">
                      {ad.vehicleType} • {ad.duration}
                    </p>
                    <div className="mt-4 flex justify-between items-center">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                          ad.status === 'Playing'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {ad.status}
                      </span>
                      <button
                        onClick={() => toggleAdStatus(ad.id)}
                        className={`p-2 rounded-full transition-colors duration-200 ${
                          ad.status === 'Playing'
                            ? 'bg-[#3674B5] hover:bg-[#0A192F]'
                            : 'bg-[#3674B5] hover:bg-[#0A192F]'
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
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminAdsControl;