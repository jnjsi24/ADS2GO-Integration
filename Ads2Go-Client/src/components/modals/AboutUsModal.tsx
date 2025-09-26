import React from 'react';

interface AboutUsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AboutUsModal: React.FC<AboutUsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 transition-opacity duration-300"
      onClick={onClose}
    >
      <div 
        className="relative bg-white rounded-lg p-8 w-[90vw] sm:w-[80vw] md:w-[70vw] lg:w-[60vw] xl:w-[50vw] max-h-[80vh] overflow-y-auto transition-all duration-300 transform"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="absolute top-4 right-4 text-gray-600 hover:text-gray-800 transition-colors duration-200 hover:scale-110 text-2xl"
          onClick={onClose}
        >
          ✕
        </button>
        
        <div className="space-y-6">
          <h2 className="text-3xl font-bold text-[#3674B5] mb-6">About Ads2Go</h2>
          
          <div className="space-y-4">
            <p className="text-gray-700 leading-relaxed">
              Ads2Go is an innovative mobile advertising platform that transforms vehicles into moving digital billboards. 
              Our mission is to connect brands with audiences in fresh, interactive ways while creating income opportunities for drivers.
            </p>
            
            <p className="text-gray-700 leading-relaxed">
              By integrating LCD screens and QR code interactivity, we create a dynamic advertising ecosystem tailored 
              for the Philippines' growing vehicle market.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mt-8">
            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="text-xl font-semibold text-[#3674B5] mb-3">Our Mission</h3>
              <p className="text-gray-700">
                To revolutionize mobile advertising by creating a sustainable ecosystem that benefits both advertisers 
                and vehicle owners while delivering measurable results.
              </p>
            </div>
            
            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="text-xl font-semibold text-[#3674B5] mb-3">Our Vision</h3>
              <p className="text-gray-700">
                To become the leading mobile advertising platform in Southeast Asia, transforming how brands 
                connect with their target audiences on the move.
              </p>
            </div>
          </div>

          <div className="mt-8">
            <h3 className="text-xl font-semibold text-[#3674B5] mb-4">Why Choose Ads2Go?</h3>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="text-center p-4">
                <div className="text-3xl mb-2">🚗</div>
                <h4 className="font-semibold mb-2">Mobile Reach</h4>
                <p className="text-sm text-gray-600">Reach audiences wherever they go with our mobile advertising network</p>
              </div>
              <div className="text-center p-4">
                <div className="text-3xl mb-2">📊</div>
                <h4 className="font-semibold mb-2">Real-time Analytics</h4>
                <p className="text-sm text-gray-600">Track performance with detailed analytics and reporting</p>
              </div>
              <div className="text-center p-4">
                <div className="text-3xl mb-2">💰</div>
                <h4 className="font-semibold mb-2">Cost Effective</h4>
                <p className="text-sm text-gray-600">Get maximum ROI with our competitive pricing and flexible plans</p>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-200">
            <h3 className="text-xl font-semibold text-[#3674B5] mb-4">Our Team</h3>
            <p className="text-gray-700">
              We're a passionate team of innovators, marketers, and technology experts dedicated to transforming 
              the advertising landscape. Our diverse backgrounds and expertise drive us to create solutions that 
              work for everyone in our ecosystem.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AboutUsModal;
