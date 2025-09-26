import React from 'react';
import { Link } from 'react-router-dom';

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PricingModal: React.FC<PricingModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const pricingPlans = [
    {
      name: 'Motorcycle Plan',
      price: '₱100,000',
      period: '/month',
      description: 'Ideal for quick urban mobility with targeted reach',
      features: [
        'Available in LCD Monitor or Vinyl Sticker',
        'Highly visible in dense traffic and urban areas',
        'Ideal for short-range but high-frequency exposure',
        'Perfect for local businesses, food outlets, and event promotions',
        'GPS tracking included',
        'Targeted routes available upon request'
      ],
      popular: false
    },
    {
      name: 'Car Plan',
      price: '₱150,000',
      period: '/month',
      description: 'Perfect for city traffic with broad visibility',
      features: [
        'Equipped with Rear or Side LCD Display / Full-body Vinyl wrap optional',
        'Ideal for city and suburban routes',
        'Balanced exposure and mobility',
        'Suitable for mid-size campaigns or service promotions',
        'Includes scheduling, tracking, and reporting dashboard',
        'Optional: Custom campaign times (rush hour only, etc.)'
      ],
      popular: true
    },
    {
      name: 'Bus Plan',
      price: '₱300,000',
      period: '/month',
      description: 'Maximum exposure with large format advertising',
      features: [
        'Available in large LCD Monitor or Full-body Vinyl wrap',
        'High visibility due to size and wide routes',
        'Covers main roads, terminals, and high-traffic locations',
        'Excellent for corporate, real estate, or product launches',
        'Long display time per location due to frequent stops',
        'Includes full analytics and route heatmaps'
      ],
      popular: false
    },
    {
      name: 'Jeepney Plan',
      price: '₱180,000',
      period: '/month',
      description: 'High visibility in suburban and rural routes',
      features: [
        'Available in roof-mounted LCD or rear/side vinyl',
        'Covers key community and commuter-heavy routes',
        'Great for mass-market brands and political ads',
        'Includes flexible route assignment (within city zones)',
        'Budget-friendly option for high-volume local engagement'
      ],
      popular: false
    }
  ];

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 transition-opacity duration-300"
      onClick={onClose}
    >
      <div 
        className="relative bg-white rounded-lg p-8 w-[95vw] sm:w-[90vw] md:w-[85vw] lg:w-[80vw] xl:w-[75vw] max-h-[90vh] overflow-y-auto transition-all duration-300 transform"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="absolute top-4 right-4 text-gray-600 hover:text-gray-800 transition-colors duration-200 hover:scale-110 text-2xl"
          onClick={onClose}
        >
          ✕
        </button>
        
        <div className="space-y-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-[#3674B5] mb-4">Pricing Plans</h2>
            <p className="text-gray-600 text-lg">Choose the perfect plan for your advertising needs</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {pricingPlans.map((plan, index) => (
              <div
                key={index}
                className={`relative bg-white rounded-lg shadow-lg border-2 p-6 hover:shadow-xl transition-all duration-300 ${
                  plan.popular ? 'border-[#3674B5] ring-2 ring-[#3674B5] ring-opacity-20' : 'border-gray-200'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-[#3674B5] text-white px-4 py-1 rounded-full text-sm font-semibold">
                      Most Popular
                    </span>
                  </div>
                )}
                
                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                  <div className="mb-2">
                    <span className="text-3xl font-bold text-[#3674B5]">{plan.price}</span>
                    <span className="text-gray-600">{plan.period}</span>
                  </div>
                  <p className="text-sm text-gray-600">{plan.description}</p>
                </div>

                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-start">
                      <div className="text-green-500 mr-2 mt-0.5">✓</div>
                      <span className="text-sm text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link to="/login">
                  <button
                    className={`w-full py-3 px-4 rounded-md font-semibold transition-all duration-200 ${
                      plan.popular
                        ? 'bg-[#3674B5] text-white hover:bg-[#2c5a8a] hover:scale-105'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Get Started
                  </button>
                </Link>
              </div>
            ))}
          </div>

          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="text-xl font-semibold text-[#3674B5] mb-4">Additional Information</h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">What's Included in All Plans:</h4>
                <ul className="space-y-1 text-sm text-gray-700">
                  <li>• Real-time performance tracking</li>
                  <li>• Detailed analytics and reporting</li>
                  <li>• 24/7 customer support</li>
                  <li>• Content approval and optimization</li>
                  <li>• Flexible campaign scheduling</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Payment Options:</h4>
                <ul className="space-y-1 text-sm text-gray-700">
                  <li>• Monthly billing available</li>
                  <li>• Quarterly and annual discounts</li>
                  <li>• Credit card and bank transfer</li>
                  <li>• Corporate payment terms</li>
                  <li>• Money-back guarantee (first 7 days)</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="text-center">
            <p className="text-gray-600 mb-4">
              Need a custom plan? Contact our sales team for personalized pricing.
            </p>
            <Link to="/login">
              <button className="bg-[#FADA7A] text-black px-6 py-3 rounded-md font-semibold hover:bg-[#DF9755] hover:scale-105 transition-all duration-300">
                Start Your Campaign Today
              </button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PricingModal;
