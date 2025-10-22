import React from 'react';

interface SimpleCarListProps {
  className?: string;
  count?: number;
}

const SimpleCarList: React.FC<SimpleCarListProps> = ({ 
  className = '', 
  count = 5 
}) => {
  // Generate car data with the DGL-HEADDRESS-CAR-XXX pattern
  const cars = Array.from({ length: count }, (_, index) => ({
    id: `DGL-HEADDRESS-CAR-${String(index + 1).padStart(3, '0')}`,
    emoji: '🚗'
  }));

  return (
    <div className={className}>
      {cars.map((car) => (
        <div key={car.id} className="text-lg">
          {car.emoji} - {car.id}
        </div>
      ))}
    </div>
  );
};

export default SimpleCarList;
