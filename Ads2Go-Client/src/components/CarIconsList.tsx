import React from 'react';

interface CarIconsListProps {
  className?: string;
  showNumbers?: boolean;
  count?: number;
}

const CarIconsList: React.FC<CarIconsListProps> = ({ 
  className = '', 
  showNumbers = true, 
  count = 5 
}) => {
  // Generate car data with the DGL-HEADDRESS-CAR-XXX pattern
  const cars = Array.from({ length: count }, (_, index) => ({
    id: `DGL-HEADDRESS-CAR-${String(index + 1).padStart(3, '0')}`,
    emoji: '🚗'
  }));

  return (
    <div className={`space-y-2 ${className}`}>
      {cars.map((car) => (
        <div 
          key={car.id}
          className="flex items-center space-x-3 p-2 bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
        >
          <span className="text-2xl" role="img" aria-label="car">
            {car.emoji}
          </span>
          {showNumbers && (
            <span className="text-gray-700 font-medium">
              {car.id}
            </span>
          )}
        </div>
      ))}
    </div>
  );
};

export default CarIconsList;
