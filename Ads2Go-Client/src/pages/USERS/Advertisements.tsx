import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Search, CircleUser } from 'lucide-react';
import { Link } from 'react-router-dom'; 

// Toast notification type
type Toast = {
  id: number;
  message: string;
  type: 'error' | 'success';
};

// Ad type
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

const Advertisements: React.FC = () => {
  const { user } = useAuth();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  const [selectedAd, setSelectedAd] = useState<Ad | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [planFilter, setPlanFilter] = useState('All Plans');
  const [showCreateAdPopup, setShowCreateAdPopup] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    vehicleType: '',
    materialsUsed: '',
    adFormat: '',
    plan: '',
    media: null as File | null,
    status: 'Pending',
  });
  const [estimatedPrice, setEstimatedPrice] = useState<number | null>(null);
  const [fullscreenMedia, setFullscreenMedia] = useState<string | null>(null);

  const materialOptionsMap: Record<string, string[]> = {
    Car: ['LCD Screen', 'Posters', 'Vinyl Sticker'],
    Motor: ['Posters', 'Vinyl Sticker'],
    Jeep: ['Posters', 'Vinyl Sticker'],
    Bus: ['LCD Screen', 'Posters'],
  };

  const priceMap: Record<string, Record<string, Record<string, number>>> = {
    Car: {
      'LCD Screen': { Weekly: 64, Monthly: 200 },
      Posters: { Weekly: 35, Monthly: 100 },
      'Vinyl Sticker': { Weekly: 40, Monthly: 120 },
    },
    Motor: {
      Posters: { Weekly: 20, Monthly: 60 },
      'Vinyl Sticker': { Weekly: 25, Monthly: 70 },
    },
    Jeep: {
      Posters: { Weekly: 30, Monthly: 90 },
      'Vinyl Sticker': { Weekly: 35, Monthly: 100 },
    },
    Bus: {
      'LCD Screen': { Weekly: 80, Monthly: 250 },
      Posters: { Weekly: 45, Monthly: 130 },
    },
  };

  // Sample ad data
  const [ads, setAds] = useState<Ad[]>([
    { id: 2632, title: 'Drive Clean Promo', riders: 5, desc: 'Promoting a sleek car wash service in Manila', date: '31 Jul 2020', price: 64.00, status: 'Pending', vehicleType: 'Car', material: 'LCD Screen', plan: 'Monthly', format: 'Image', imagePath: '/image/blue-logo.png' },
    { id: 2633, title: 'Urban Threads Campaign', riders: 67, desc: 'Launching a streetwear campaign across Cebu', date: '01 Aug 2020', price: 35.00, status: 'Dispatch', vehicleType: 'Motor', material: 'Posters', plan: 'Weekly', format: 'Video', imagePath: '/image/duck.gif' },
    { id: 2634, title: 'Fresh Harvest Tour', riders: 10, desc: 'Highlighting local farm produce in Quezon City', date: '02 Aug 2020', price: 74.00, status: 'Completed', vehicleType: 'Jeep', material: 'Vinyl Sticker', plan: 'Monthly', format: 'Image', imagePath: '/image/black-logo.png' },
    { id: 2635, title: 'Beach Bliss Offers', riders: 3, desc: 'Summer promo for beachfront resort in Batangas', date: '02 Aug 2020', price: 82.00, status: 'Pending', vehicleType: 'Bus', material: 'LCD Screen', plan: 'Weekly', format: 'Video', imagePath: '/image/cat.avif' },
    { id: 2636, title: 'eRide Makati Launch', riders: 8, desc: 'Promoting electric vehicle rentals in Makati', date: '03 Aug 2020', price: 38.00, status: 'Dispatch', vehicleType: 'Car', material: 'Posters', plan: 'Monthly', format: 'Image', imagePath: '/image/large.jpg' },
    { id: 2637, title: 'GlowUp Skincare Push', riders: 15, desc: 'Introducing a new skincare brand to college students', date: '03 Aug 2020', price: 67.00, status: 'Completed', vehicleType: 'Motor', material: 'Vinyl Sticker', plan: 'Weekly', format: 'Video',  imagePath: '/image/neko.webp'},
    { id: 2638, title: 'TechArmor Mobile Blast', riders: 15, desc: 'Promoting mobile accessories in high-traffic areas', date: '03 Aug 2020', price: 67.00, status: 'Pending', vehicleType: 'Motor', material: 'Vinyl Sticker', plan: 'Weekly', format: 'Video' },
    { id: 2639, title: 'Campus Reads Promo', riders: 15, desc: 'Back-to-school campaign for local bookstore chain', date: '03 Aug 2020', price: 67.00, status: 'Completed', vehicleType: 'Motor', material: 'Vinyl Sticker', plan: 'Weekly', format: 'Video' },
    { id: 2640, title: 'StartUp Spark PH', riders: 15, desc: 'Advert for tech startup launching in Metro Manila', date: '03 Aug 2020', price: 67.00, status: 'Dispatch', vehicleType: 'Motor', material: 'Vinyl Sticker', plan: 'Weekly', format: 'Video' },
    { id: 2641, title: 'CareClinic Awareness Ride', riders: 15, desc: 'Health awareness campaign for a local clinic', date: '03 Aug 2020', price: 67.00, status: 'Dispatch', vehicleType: 'Motor', material: 'Vinyl Sticker', plan: 'Weekly', format: 'Video' },
    { id: 2642, title: 'FlexFit Ad Rollout', riders: 15, desc: 'Promoting a fitness app for on-the-go workouts', date: '03 Aug 2020', price: 67.00, status: 'Pending', vehicleType: 'Motor', material: 'Vinyl Sticker', plan: 'Weekly', format: 'Video' },
  ]);

  const [materialsOptions, setMaterialsOptions] = useState<string[]>([]);

  useEffect(() => {
    if (formData.vehicleType) {
      setMaterialsOptions(materialOptionsMap[formData.vehicleType] || []);
      setFormData(prev => ({ ...prev, materialsUsed: '' }));
    }
  }, [formData.vehicleType]);

  useEffect(() => {
    const { vehicleType, materialsUsed, plan } = formData;
    const price = priceMap[vehicleType]?.[materialsUsed]?.[plan] ?? null;
    setEstimatedPrice(price);
  }, [formData.vehicleType, formData.materialsUsed, formData.plan]);

  // Debugging filter state
  useEffect(() => {
    console.log('Filter State:', { 
      searchTerm, 
      statusFilter, 
      planFilter, 
      filteredAdsLength: filteredAds.length,
      filteredAds: filteredAds.map(ad => ({ id: ad.id, title: ad.title, status: ad.status, plan: ad.plan }))
    });
  }, [searchTerm, statusFilter, planFilter, ads]);

  const addToast = (message: string, type: 'error' | 'success' = 'error') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 5000);
  };

  const removeToast = (id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  const handleDeleteAd = (id: number) => {
    const message = 'Are you sure you want to delete this ad?';
    const callback = () => {
      setAds((prev) => prev.filter((ad) => ad.id !== id));
      addToast('Ad deleted successfully.', 'success');
    };
    showConfirmModal(message, callback);
  };

  const showConfirmModal = (message: string, callback: () => void) => {
    if (window.confirm(message)) {
      callback();
    }
  };

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;

  const filteredAds = ads.filter(ad => {
  const matchesSearch = ad.title.toLowerCase().includes(searchTerm.toLowerCase().trim()) || 
                       ad.id.toString().includes(searchTerm.trim());
  const matchesStatus = statusFilter === 'All Status' || ad.status === statusFilter;
  const matchesPlan = planFilter === 'All Plans' || ad.plan === planFilter;
  console.log(`Ad ID: ${ad.id}, Title: ${ad.title}, Matches:`, { matchesSearch, matchesStatus, matchesPlan, searchTerm });
  return matchesSearch && matchesStatus && matchesPlan;
});

  const currentAds = filteredAds.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredAds.length / itemsPerPage);

  const startItem = indexOfFirstItem + 1;
  const endItem = Math.min(indexOfLastItem, filteredAds.length);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handleAdClick = (ad: Ad) => {
    setSelectedAd(ad);
  };

  const handleClosePopup = () => {
    setSelectedAd(null);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, files } = e.target as HTMLInputElement;
    if (name === 'media' && files) {
      setFormData((prev) => ({ ...prev, media: files[0] }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Generate a new ad ID
    const newId = Math.max(...ads.map(ad => ad.id)) + 1;
    
    // Create new ad object
    const newAd: Ad = {
      id: newId,
      title: formData.title.trim(), // Trim title to avoid spaces
      riders: Math.floor(Math.random() * 100) + 1,
      desc: formData.description,
      date: new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }),
      price: estimatedPrice || 0,
      status: 'Pending',
      vehicleType: formData.vehicleType as Ad['vehicleType'],
      material: formData.materialsUsed as Ad['material'],
      plan: formData.plan as Ad['plan'],
      format: formData.adFormat === 'Video' ? 'Video' : 'Image',
      imagePath: formData.media ? URL.createObjectURL(formData.media) : undefined
    };

    // Add the new ad and reset page
    setAds(prev => [...prev, newAd]);
    setCurrentPage(1); // Reset to first page
    addToast('Advertisement created successfully!', 'success');
    setShowCreateAdPopup(false);
    setFormData({
      title: '',
      description: '',
      vehicleType: '',
      materialsUsed: '',
      adFormat: '',
      plan: '',
      media: null,
      status: 'Pending',
    });
    console.log('New Ad Added:', newAd);
  };

  return (
    <div className="flex-1 pl-60 pb-6 bg-white">
      {/* Header with Search and Company Name */}
      <div className="bg-white p-6 shadow flex justify-between items-center">
        <div className="relative w-96">
          <input
            type="text"
            placeholder="Search Ads"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border border-gray-500 w-full rounded-md p-2 pl-10 focus:outline-none"
          />
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        </div>
      </div>
      <div className="bg-gray-50">
      </div>
      {/* Advertisements, Ads Found, and Add New Ads */}
      <div className="bg-white p-6 flex justify-between items-center">
        <h1 className="text-3xl font-semibold">Advertisements</h1>
        <div className="flex space-x-3">
          <span className="pt-1 text-gray-500">{filteredAds.length} Ads found</span>
          <button 
            onClick={() => setShowCreateAdPopup(true)}
            className="px-4 py-2 bg-[#FADA7A] text-black text-sm font-semibold w-32 rounded-md hover:bg-[#F5F0CD] hover:scale-105 transition-all duration-300"
          >
            Add New Ads
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-1 pl-5 flex justify-between items-center">
        <div className="space-x-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white border border-gray-300 rounded-md p-2 focus:outline-none"
          >
            <option value="All Status">All Status</option>
            <option value="Pending">Pending</option>
            <option value="Dispatch">Dispatch</option>
            <option value="Completed">Completed</option>
          </select>
          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
            className="bg-white border border-gray-300 rounded-md p-2 focus:outline-none"
          >
            <option value="All Plans">All Plans</option>
            <option value="Monthly">Monthly</option>
            <option value="Weekly">Weekly</option>
          </select>
        </div>
      </div>

      {/* Ad Cards */}
      <div className="bg-white p-6 grid grid-cols-4 gap-6">
        {currentAds.length > 0 ? (
          currentAds.map((ad) => (
            <div
              key={ad.id}
              className="rounded-xl shadow-lg overflow-hidden cursor-pointer relative flex flex-col h-full hover:scale-105 transition-all duration-300"
            >
              <div className="w-full h-48 flex-shrink-0 relative">
  {ad.format === 'Video' && ad.imagePath ? (
    <>
      <video
        src={ad.imagePath}
        className="w-full h-full object-cover"
        controls
        onClick={(e) => {
          e.stopPropagation();
          if (ad.imagePath) setFullscreenMedia(ad.imagePath);
        }}
      >
        Your browser does not support the video tag.
      </video>
      <div className="absolute bottom-2 right-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm">
        Click to view fullscreen
      </div>
    </>
  ) : ad.imagePath ? (
    <>
      <img 
        src={ad.imagePath} 
        alt={`${ad.title} image`} 
        className="w-full h-full object-cover"
        onClick={(e) => {
          e.stopPropagation();
          if (ad.imagePath) setFullscreenMedia(ad.imagePath);
        }}
      />
      <div className="absolute bottom-2 right-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm">
        Click to view fullscreen
      </div>
    </>
  ) : (
    <div className="w-full h-full bg-gray-500 flex items-center justify-center text-white">
      No Image
    </div>
  )}
</div>
              
              <div className="p-4 bg-gray-100 flex-grow flex flex-col">
                <div 
                  className="flex-grow cursor-pointer"
                  onClick={() => handleAdClick(ad)}
                >
                  <h3 className="text-2xl font-semibold text-black">{ad.title}</h3>
                  <p className="text-md text-gray-600">{ad.plan} Plan</p>
                  <p className="text-sm text-gray-500 mt-2">{ad.date}</p>
                </div>
                
                <div className="mt-4 pt-5 border-t border-gray-200">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAdClick(ad);
                    }}
                    className="text-white text-sm bg-[#3674B5] font-semibold rounded-lg px-4 py-2 flex items-center justify-between w-full hover:bg-[#578FCA] hover:text-white transition-colors"
                  >
                    View Details <span>→</span>
                  </button>
                </div>
              </div>
              
              <span className={`absolute top-2 left-2 inline-block px-2 py-1 text-xs font-semibold rounded ${ad.status === 'Pending' ? 'bg-yellow-200 text-yellow-800' : ad.status === 'Dispatch' ? 'bg-green-200 text-green-800' : 'bg-gray-200 text-gray-800'}`}>
                {ad.status}
              </span>
            </div>
          ))
        ) : (
          <div className="col-span-4 text-center text-gray-500">
            No advertisements found for the selected filters.
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="p-4 rounded-lg mt-6 flex justify-between items-center">
        <span className="text-gray-500">
          Showing {startItem}-{endItem} of {filteredAds.length}
        </span>
        <div className="flex space-x-2">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-2 py-1 border border-gray-300 rounded disabled:opacity-50"
          >
            «
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              onClick={() => handlePageChange(page)}
              className={`px-2 py-1 border border-gray-300 rounded ${
                currentPage === page ? 'bg-[#3674B5] text-white' : ''
              }`}
            >
              {page}
            </button>
          ))}
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="px-2 py-1 border border-gray-300 rounded disabled:opacity-50"
          >
            »
          </button>
        </div>
      </div>

      {/* Toast Notifications */}
      <div className="fixed bottom-4 right-4 space-y-2 z-50">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`text-white px-4 py-2 rounded-md shadow-lg flex items-center justify-between max-w-xs animate-slideIn ${toast.type === 'error' ? 'bg-red-400' : 'bg-green-400'}`}
          >
            <span>{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              className="ml-4 text-white hover:text-gray-200"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Fullscreen Media Viewer */}
      {fullscreenMedia && (
        <div 
          className="fixed inset-0 bg-white h-full bg-opacity-50 z-[60] pr-1 flex items-center justify-center p-4"
          onClick={() => setFullscreenMedia(null)}
        >
          {selectedAd?.format === 'Video' ? (
            <video 
              src={fullscreenMedia}
              className="max-w-full max-h-full object-contain"
              controls
              autoPlay
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <img 
              src={fullscreenMedia} 
              className="max-w-80 max-h-full  object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </div>
      )}

      {/* Ad Details Popup */}
      {selectedAd && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-auto max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex p-2">
              {/* Media Section */}
              <div className="w-1/2 pr-4">
  {selectedAd.format === 'Video' && selectedAd.imagePath ? (
    <video
      src={selectedAd.imagePath}
      className="w-auto h-40 ml-2 mt-6 object-cover rounded-lg"
      controls
    >
      Your browser does not support the video tag.
    </video>
  ) : selectedAd.format === 'Image' && selectedAd.imagePath ? (
    <img 
      src={selectedAd.imagePath} 
      alt={`${selectedAd.title} image`} 
      className="w-auto pl-5 h-52 mt-6 object-cover rounded-lg"
    />
  ) : (
    <div className="w-full h-64 bg-gray-300 flex items-center justify-center text-gray-500 rounded-lg">
      No Media
    </div>
  )}
</div>
              
              {/* Info Section */}
              <div className="w-1/2 p-2 flex flex-col justify-between">
                <div>
                  <h2 className="text-3xl font-semibold mb-2">{selectedAd.title}</h2>
                  <p className="text-md text-gray-600 mb-1">{selectedAd.plan} Plan</p>
                  <p className="text-md text-gray-600">{selectedAd.date}</p>
                  <p className="text-sm text-black pt-6">{selectedAd.desc}</p>
                </div>
              </div>
            </div>
            
            {/* Details Section */}
            <div className="p-4 bg-white">
              <div className="text-sm text-gray-700 pl-3 grid grid-cols-2 gap-2">
                {/* Left Column: Materials and Date Ended */}
                    <p className="text-sm text-black"><strong>Materials:</strong> {selectedAd.material}</p>
                    <p className="text-sm text-black"><strong>Date Ended:</strong> {selectedAd.date}</p>
                    <p className="text-sm text-black"><strong>Price:</strong> ${selectedAd.price.toFixed(2)}</p>
                {/* Right Column: Vehicle Type, Riders */}
                    <p className="text-sm text-black"><strong>Vehicle Type:</strong> {selectedAd.vehicleType}</p>
                    <p className="text-sm text-black"><strong>Riders:</strong> {selectedAd.riders}</p>
                  </div>
              <div className="flex justify-between items-center mt-10">
                <span className={`inline-block px-2 py-1 text-sm font-semibold rounded ${selectedAd.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' : selectedAd.status === 'Dispatch' ? 'bg-green-200 text-green-800' : 'bg-gray-200 text-gray-800'}`}>
                  {selectedAd.status} ID: #{selectedAd.id}
                </span>
                <button
                  onClick={handleClosePopup}
                  className="px-4 py-2 bg-[#F3A26D] text-white rounded-md hover:bg-[#DF9755]"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Ad Popup - Right Side Version */}
      {showCreateAdPopup && (
        <div className="fixed inset-0 z-50 flex justify-end pr-2">
          {/* Overlay with click-to-close functionality */}
          <div 
            className="fixed inset-0 bg-black bg-opacity-30"
            onClick={() => setShowCreateAdPopup(false)}
          ></div>
          
          {/* Form container sliding in from right */}
          <div className="relative w-full max-w-xl h-[730px] pb-6 rounded-lg bg-white mt-2 shadow-lg transform transition-transform duration-300 ease-in-out">
            <div className="p-6 h-full overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Create New Advertisement</h2>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4 mt-9">
                <input
                  type="text"
                  name="title"
                  placeholder="Title"
                  value={formData.title}
                  onChange={handleChange}
                  className="w-full border border-[#3674B5] rounded-lg p-2 focus outline-none"
                  required
                />

                <textarea
                  name="description"
                  placeholder="Description"
                  value={formData.description}
                  onChange={handleChange}
                  className="w-full border border-[#3674B5] rounded-lg p-2 focus outline-none"
                  required
                  rows={3}
                />

                <select
                  name="vehicleType"
                  value={formData.vehicleType}
                  onChange={handleChange}
                  className="w-full border border-[#3674B5] rounded-lg p-2 focus outline-none"
                  required
                >
                  <option value="">Select Vehicle Type</option>
                  <option value="Car">Car</option>
                  <option value="Motor">Motor</option>
                  <option value="Jeep">Jeep</option>
                  <option value="Bus">Bus</option>
                </select>

                <select
                  name="materialsUsed"
                  value={formData.materialsUsed}
                  onChange={handleChange}
                  className="w-full border border-[#3674B5] rounded-lg p-2 focus outline-none"
                  required
                  disabled={!formData.vehicleType}
                >
                  <option value="">Select Material</option>
                  {materialsOptions.map((material) => (
                    <option key={material} value={material}>{material}</option>
                  ))}
                </select>

                <select
                  name="plan"
                  value={formData.plan}
                  onChange={handleChange}
                  className="w-full border border-[#3674B5] rounded-lg p-2 focus outline-none"
                  required
                >
                  <option value="">Select Plan</option>
                  <option value="Weekly">Weekly</option>
                  <option value="Monthly">Monthly</option>
                </select>

                {formData.vehicleType && formData.materialsUsed && formData.plan && (
                  <div className="text-green-700 font-semibold">
                    {estimatedPrice !== null
                      ? `Total Price: $${estimatedPrice.toFixed(2)}`
                      : <span className="text-red-600">Price unavailable for selected options</span>}
                  </div>
                )}

                <select
                  name="adFormat"
                  value={formData.adFormat}
                  onChange={handleChange}
                  className="w-full border border-[#3674B5] rounded-lg p-2 focus outline-none"
                  required
                >
                  <option value="">Select Format</option>
                  <option value="Image">Image</option>
                  <option value="Video">Video</option>
                </select>

                <div className="border border-[#3674B5] rounded-lg p-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Media Upload</label>
                  <input
                    type="file"
                    name="media"
                    accept="image/*,video/*"
                    onChange={handleChange}
                    className="w-full"
                    required
                  />
                </div>

                <div className="flex justify-end space-x-4 pt-16">
                  <button
                    type="button"
                    onClick={() => setShowCreateAdPopup(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                  <Link to='/payment'>
                  <button
                    type="submit"
                    className="px-6 py-2 rounded-lg bg-[#3674B5] hover:bg-[#578FCA] text-white font-semibold shadow hover:scale-105 transition-all duration-300"
                  >
                    Create Advertisement
                  </button>
                  </Link>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      <style> 
        {`
          @keyframes slideIn {
            from {
              transform: translateX(100%);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }
          .animate-slideIn {
            animation: slideIn 0.3s ease-out;
          }
        `}
      </style>
    </div>
  );
};

export default Advertisements;