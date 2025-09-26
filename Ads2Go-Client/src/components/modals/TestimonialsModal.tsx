import React, { useState } from 'react';

interface TestimonialsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Testimonial {
  id: number;
  name: string;
  title: string;
  company: string;
  image: string;
  quote: string;
  rating: number;
  campaign: string;
  results: string;
}

const TestimonialsModal: React.FC<TestimonialsModalProps> = ({ isOpen, onClose }) => {
  const [selectedTestimonial, setSelectedTestimonial] = useState<Testimonial | null>(null);

  const testimonials: Testimonial[] = [
    {
      id: 1,
      name: 'Rajesh Kumar',
      title: 'Business Owner',
      company: 'Kumar Electronics',
      image: '/image/client1.jpg',
      quote: 'Increased my sales by 30% with mobile ads! The targeted approach helped me reach exactly the customers I needed. The ROI was incredible.',
      rating: 5,
      campaign: 'Motorcycle Plan - 3 months',
      results: '30% increase in sales, 150% ROI'
    },
    {
      id: 2,
      name: 'Priya Sharma',
      title: 'Marketing Manager',
      company: 'Sharma Restaurants',
      image: '/image/client1.jpg',
      quote: 'Amazing reach and easy to manage campaigns. The real-time analytics helped us optimize our messaging and timing perfectly.',
      rating: 5,
      campaign: 'Car Plan - 6 months',
      results: '45% increase in foot traffic, 200% ROI'
    },
    {
      id: 3,
      name: 'Amit Singh',
      title: 'Driver',
      company: 'Independent Driver',
      image: '/image/client1.jpg',
      quote: 'I earned extra income by displaying digital ads on my vehicle while doing my regular driving routes. It was a great way to make passive money without changing my routine—I just drove like I normally do, and the ads ran automatically.',
      rating: 5,
      campaign: 'Motorcycle Plan - 12 months',
      results: '₱15,000 additional monthly income'
    },
    {
      id: 4,
      name: 'Maria Santos',
      title: 'Marketing Director',
      company: 'Santos Real Estate',
      image: '/image/client1.jpg',
      quote: 'The bus plan gave us incredible visibility for our property launches. We saw a 60% increase in inquiries and several successful sales directly attributed to the mobile ads.',
      rating: 5,
      campaign: 'Bus Plan - 4 months',
      results: '60% increase in inquiries, 8 direct sales'
    },
    {
      id: 5,
      name: 'John Chen',
      title: 'CEO',
      company: 'Chen Tech Solutions',
      image: '/image/client1.jpg',
      quote: 'Professional service, excellent results. The team helped us create compelling ad content and the jeepney routes were perfect for reaching our target demographic.',
      rating: 5,
      campaign: 'Jeepney Plan - 6 months',
      results: '40% increase in brand awareness, 180% ROI'
    },
    {
      id: 6,
      name: 'Sarah Johnson',
      title: 'Event Coordinator',
      company: 'Johnson Events',
      image: '/image/client1.jpg',
      quote: 'Perfect for promoting our events! The mobile ads helped us reach people on their daily commutes and significantly increased our event attendance.',
      rating: 5,
      campaign: 'Car Plan - 2 months',
      results: '50% increase in event attendance'
    }
  ];

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <span key={i} className={i < rating ? 'text-yellow-400' : 'text-gray-300'}>
        ★
      </span>
    ));
  };

  if (!isOpen) return null;

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
            <h2 className="text-3xl font-bold text-[#3674B5] mb-4">Customer Testimonials</h2>
            <p className="text-gray-600 text-lg">See what our clients say about their experience with Ads2Go</p>
          </div>

          {/* Stats Section */}
          <div className="grid md:grid-cols-4 gap-6 bg-gray-50 rounded-lg p-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-[#3674B5]">500+</div>
              <div className="text-sm text-gray-600">Happy Clients</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-[#3674B5]">4.9/5</div>
              <div className="text-sm text-gray-600">Average Rating</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-[#3674B5]">150%</div>
              <div className="text-sm text-gray-600">Average ROI</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-[#3674B5]">24/7</div>
              <div className="text-sm text-gray-600">Support</div>
            </div>
          </div>

          {/* Testimonials Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {testimonials.map((testimonial) => (
              <div
                key={testimonial.id}
                className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-all duration-300 cursor-pointer"
                onClick={() => setSelectedTestimonial(testimonial)}
              >
                <div className="flex items-center mb-4">
                  <img
                    src={testimonial.image}
                    alt={testimonial.name}
                    className="w-12 h-12 rounded-full object-cover mr-4"
                  />
                  <div>
                    <h4 className="font-semibold text-gray-900">{testimonial.name}</h4>
                    <p className="text-sm text-gray-600">{testimonial.title}</p>
                    <p className="text-xs text-gray-500">{testimonial.company}</p>
                  </div>
                </div>
                
                <div className="flex items-center mb-3">
                  <div className="flex text-lg">
                    {renderStars(testimonial.rating)}
                  </div>
                </div>
                
                <p className="text-gray-700 text-sm mb-4 line-clamp-3">
                  "{testimonial.quote}"
                </p>
                
                <div className="text-xs text-gray-500">
                  <div className="font-semibold">Campaign:</div>
                  <div>{testimonial.campaign}</div>
                  <div className="font-semibold mt-1">Results:</div>
                  <div className="text-green-600">{testimonial.results}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Detailed Testimonial Modal */}
          {selectedTestimonial && (
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60"
              onClick={() => setSelectedTestimonial(null)}
            >
              <div 
                className="relative bg-white rounded-lg p-8 w-[90vw] sm:w-[80vw] md:w-[70vw] lg:w-[60vw] xl:w-[50vw] max-h-[80vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  className="absolute top-4 right-4 text-gray-600 hover:text-gray-800 transition-colors duration-200 hover:scale-110 text-2xl"
                  onClick={() => setSelectedTestimonial(null)}
                >
                  ✕
                </button>
                
                <div className="space-y-6">
                  <div className="flex items-center">
                    <img
                      src={selectedTestimonial.image}
                      alt={selectedTestimonial.name}
                      className="w-16 h-16 rounded-full object-cover mr-6"
                    />
                    <div>
                      <h3 className="text-2xl font-bold text-gray-900">{selectedTestimonial.name}</h3>
                      <p className="text-lg text-gray-600">{selectedTestimonial.title}</p>
                      <p className="text-gray-500">{selectedTestimonial.company}</p>
                      <div className="flex text-xl mt-2">
                        {renderStars(selectedTestimonial.rating)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 p-6 rounded-lg">
                    <p className="text-lg text-gray-700 italic">
                      "{selectedTestimonial.quote}"
                    </p>
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">Campaign Details</h4>
                      <p className="text-gray-700">{selectedTestimonial.campaign}</p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">Results Achieved</h4>
                      <p className="text-green-600 font-semibold">{selectedTestimonial.results}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="text-center bg-[#3674B5] text-white rounded-lg p-8">
            <h3 className="text-2xl font-bold mb-4">Ready to Join Our Success Stories?</h3>
            <p className="text-lg mb-6">Start your mobile advertising campaign today and see results like our satisfied clients.</p>
            <button className="bg-[#FADA7A] text-black px-8 py-3 rounded-md font-semibold hover:bg-[#DF9755] hover:scale-105 transition-all duration-300">
              Get Started Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestimonialsModal;
