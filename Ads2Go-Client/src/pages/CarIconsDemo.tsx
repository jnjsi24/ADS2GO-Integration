import React from 'react';
import CarIconsList from '../components/CarIconsList';
import SimpleCarList from '../components/SimpleCarList';

const CarIconsDemo: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">
          Car Icons Demo
        </h1>
        
        <div className="grid md:grid-cols-2 gap-8">
          {/* Simple List Version */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Simple List Format
            </h2>
            <SimpleCarList />
          </div>
          
          {/* Card Version */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Card Format
            </h2>
            <CarIconsList />
          </div>
        </div>
        
        {/* Custom Count Example */}
        <div className="mt-8 bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Custom Count (10 cars)
          </h2>
          <SimpleCarList count={10} />
        </div>
      </div>
    </div>
  );
};

export default CarIconsDemo;
