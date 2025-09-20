import React, { useState } from 'react';

interface ContentManagementProps {
  onDeployAd?: (adId: string, targetScreens: string[], schedule?: any) => void;
}

const ContentManagement: React.FC<ContentManagementProps> = ({ onDeployAd }) => {
  const [selectedContent, setSelectedContent] = useState('');
  const [targetScreens, setTargetScreens] = useState('');
  const [schedule, setSchedule] = useState('');
  const [priority, setPriority] = useState('');

  const handleDeploy = () => {
    if (onDeployAd && selectedContent) {
      // Convert selected content to adId (in real implementation, this would be proper mapping)
      const adId = selectedContent.toLowerCase().replace(/\s+/g, '-');
      const screens = targetScreens === 'All Screens' ? [] : [targetScreens]; // Simplified for demo
      onDeployAd(adId, screens, { schedule, priority });
    }
  };

  const mockContent = [
    { id: 1, title: 'Sample Ad #1', duration: '3:00', size: '15.2 MB', advertiser: 'ABC Company' },
    { id: 2, title: 'Product Demo', duration: '2:30', size: '12.8 MB', advertiser: 'XYZ Corp' },
    { id: 3, title: 'Brand Story', duration: '4:00', size: '20.1 MB', advertiser: 'Brand Co' },
    { id: 4, title: 'Company Intro', duration: '1:30', size: '8.5 MB', advertiser: 'Intro Inc' },
    { id: 5, title: 'Call to Action', duration: '2:00', size: '10.3 MB', advertiser: 'Action Ltd' }
  ];

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Content Management</h3>
      
      {/* Content Library */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h4 className="font-medium mb-3">Content Library</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {mockContent.map((ad) => (
            <div key={ad.id} className="bg-white p-4 rounded-lg border">
              <h5 className="font-medium mb-2">{ad.title}</h5>
              <div className="text-sm text-gray-600 space-y-1">
                <div>Duration: {ad.duration}</div>
                <div>Size: {ad.size}</div>
                <div>Advertiser: {ad.advertiser}</div>
              </div>
              <div className="flex space-x-2 mt-3">
                <button className="px-3 py-1 bg-blue-100 text-blue-600 rounded text-sm hover:bg-blue-200">
                  Preview
                </button>
                <button 
                  onClick={() => setSelectedContent(ad.title)}
                  className="px-3 py-1 bg-green-100 text-green-600 rounded text-sm hover:bg-green-200"
                >
                  Deploy
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Content Deployment */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h4 className="font-medium mb-3">Content Deployment</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Select Content</label>
            <select 
              value={selectedContent}
              onChange={(e) => setSelectedContent(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              <option value="">Choose content...</option>
              {mockContent.map((ad) => (
                <option key={ad.id} value={ad.title}>{ad.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Target Screens</label>
            <select 
              value={targetScreens}
              onChange={(e) => setTargetScreens(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              <option value="">Choose target...</option>
              <option value="All Screens">All Screens</option>
              <option value="Selected Screens">Selected Screens</option>
              <option value="By Location">By Location</option>
              <option value="By Material">By Material</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Schedule</label>
            <select 
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              <option value="">Choose schedule...</option>
              <option value="Immediate">Immediate</option>
              <option value="Scheduled">Scheduled</option>
              <option value="Recurring">Recurring</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Priority</label>
            <select 
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              <option value="">Choose priority...</option>
              <option value="Normal">Normal</option>
              <option value="High">High</option>
              <option value="Emergency">Emergency</option>
            </select>
          </div>
        </div>
        <div className="flex space-x-2 mt-4">
          <button 
            onClick={handleDeploy}
            disabled={!selectedContent}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Deploy Now
          </button>
          <button 
            disabled={!selectedContent}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Schedule
          </button>
          <button 
            disabled={!selectedContent}
            className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save Draft
          </button>
        </div>
      </div>
    </div>
  );
};

export default ContentManagement;
