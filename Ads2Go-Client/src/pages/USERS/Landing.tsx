import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Define the Testimonial interface
interface Testimonial {
  image: string;
  name: string;
  title: string;
  quote: string;
}

export default function Home() {
  const navigate = useNavigate();

  // State for the hero slideshow
  const [currentSlide, setCurrentSlide] = useState(0);

  // State for the popup in the footer
  const [showPopup, setShowPopup] = useState(false);

  // State for the testimonial popup, typed as Testimonial | null
  const [selectedTestimonial, setSelectedTestimonial] = useState<Testimonial | null>(null);

  // Slides data for the hero section
  const slides = [
    {
      title: "Capture Attention Where It Counts — On the Move",
      description: "Boost your brand with mobile advertising solutions that drive visibility, engagement, and growth — anytime, anywhere.",
      buttonText: "+ Register Ad Campaign",
      buttonLink: "/login",
      videoSrc: "/image/home.mp4",
    },
    {
      title: "Drive Your Brand Forward with Mobile Advertising",
      description: "Reach your audience on the go with our innovative mobile ad solutions, designed to maximize impact and engagement.",
      buttonText: "Learn More",
      buttonLink: "/login",
      videoSrc: "/image/home2.mp4", 
    },
  ];

  // Automatic slideshow effect for the hero section
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev === 0 ? 1 : 0));
    }, 6000); // Slide changes every 6 seconds

    return () => clearInterval(interval); // Cleanup interval on component unmount
  }, []);

  // Vehicle data
  const vehicles = [
    {
      label: 'Motorcycle Plan',
      desc: 'Ideal for quick urban mobility with targeted reach.',
      material: 'Vinyl Sticker, LCD Display',
      stats: { duration: 'Up to 3 Months', price: '50k per year', area: 'NCR' },
    },
    {
      label: 'Car Plan',
      desc: 'Perfect for city traffic with broad visibility.',
      material: 'Vinyl Sticker, LCD Display',
      stats: { duration: 'Up to 3 Months', price: '100k per year', area: 'NCR' },
    },
    {
      label: 'Bus Plan',
      desc: 'Maximum exposure with large format advertising.',
      material: 'Vinyl Sticker, LCD Display',
      stats: { duration: 'Up to 3 Months', price: '150k per year', area: 'NCR' },
    },
    {
      label: 'Jeepney Plan',
      desc: 'High visibility in suburban and rural routes.',
      material: 'Vinyl Sticker, LCD Display',
      stats: { duration: 'Up to 3 Months', price: '120k per year', area: 'NCR' },
    },
  ];

  const [current, setCurrent] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    if (isTransitioning) {
      const timer = setTimeout(() => {
        setIsTransitioning(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [current, isTransitioning]);

  const nextSlide = () => {
    if (!isTransitioning) {
      setIsTransitioning(true);
      setCurrent((prev) => (prev + 1) % vehicles.length);
    }
  };

  const prevSlide = () => {
    if (!isTransitioning) {
      setIsTransitioning(true);
      setCurrent((prev) => (prev - 1 + vehicles.length) % vehicles.length);
    }
  };

  const getVisibleItems = () => {
    const items = [];
    const totalItems = vehicles.length;
    const prevIndex = (current - 1 + totalItems) % totalItems;
    items.push({ ...vehicles[prevIndex], className: 'opacity-20 scale-100 -translate-x-10' });
    items.push({ ...vehicles[current % totalItems], className: 'z-10' });
    const nextIndex = (current + 1) % totalItems;
    items.push({ ...vehicles[nextIndex], className: 'opacity-0 scale-90 translate-x-10' });
    return items;
  };

  // Testimonial data
  const testimonials: Testimonial[] = [
    {
      image: '/image/client1.jpg',
      name: 'Rajesh Kumar',
      title: 'Business Owner',
      quote: 'Increased my sales by 30% with mobile ads!',
    },
    {
      image: '/image/client1.jpg',
      name: 'Priya Sharma',
      title: 'Marketing Manager',
      quote: 'Amazing reach and easy to manage campaigns.',
    },
    {
      image: '/image/client1.jpg',
      name: 'Amit Singh',
      title: 'Driver',
      quote: 'I earned extra income by displaying digital ads on my vehicle while doing my regular driving routes. It was a great way to make passive money without changing my routine—I just drove like I normally do, and the ads ran automatically.',
    },
  ];

  // Handle email form submission for the popup
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setShowPopup(true);
    setTimeout(() => setShowPopup(false), 3000); // Hide popup after 3 seconds
  };

  // Type the testimonial parameter
  const handleTestimonialClick = (testimonial: Testimonial) => {
    setSelectedTestimonial(testimonial);
  };

  const handleClosePopup = () => {
    setSelectedTestimonial(null);
  };

  return (
    <div className="min-h-screen relative">
  {/* Hero Section - Slideshow */}
  <section className="relative py-20 px-2 pr-44 text-black min-h-[90vh] flex items-center overflow-hidden">
    <video
      autoPlay
      muted
      loop
      className="absolute top-0 left-0 w-full h-full object-cover z-0"
      src={slides[currentSlide].videoSrc}
    >
      Your browser does not support the video tag.
    </video>
    <div className="container mx-auto max-w-screen-xl relative z-10">
      {slides.map((slide, index) => (
        <div
          key={index}
          className={`absolute inset-0 transition-opacity duration-1000 ${
            currentSlide === index ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div className="max-w-4xl text-left">
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-4 animate-fadeDown">
              {slide.title}
            </h1>
            <p className="text-xl md:text-2xl mb-8 animate-fadeDown delay-100">
              {slide.description}
            </p>
            <div className="flex flex-wrap gap-4">
              <Link to={slide.buttonLink}>
                <button className="px-6 py-3 text-sm font-semibold bg-[#FADA7A] text-white border rounded-[8px] hover:bg-[#DF9755] hover:scale-105 transition-all duration-300">
                  {slide.buttonText}
                </button>
              </Link>
            </div>
            {/* Circle Indicators */}
            <div className="absolute bottom-90 left-1/2 transform -translate-x-1/2 flex gap-2 z-20">
              {slides.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentSlide(index)}
                  className={`w-3 h-3 rounded-full ${currentSlide === index ? 'bg-white' : 'bg-gray-400'} hover:bg-white transition-colors duration-300`}
                ></button>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  </section>

      {/* Our Clients Section */}
      <section className="py-16 px-4 bg-white">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl font-bold mb-8 animate-fadeDown">Our Clients</h2>
          <div className="flex justify-center gap-12 mb-8">
            <img src="/image/bg1.png" alt="Client 1" className="h-16 animate-pulse" />
            <img src="/image/bg2.png" alt="Client 2" className="h-16 animate-pulse delay-100" />
            <img src="/image/bus.png" alt="Client 3" className="h-16 animate-pulse delay-200" />
          </div>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto animate-fadeDown delay-200">
            We have been working with some Fortune 500+ clients
          </p>
        </div>
      </section>

      <section className="py-16 px-4 bg-gray-50 flex items-center justify-center">
  <div className="container mx-auto max-w-screen-xl text-center">
    <h2 className="text-3xl font-bold mb-8 animate-fadeDown">Easily manage your ads in just a few simple steps</h2>
    <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
      <div className="p-6 rounded-lg shadow-md hover:scale-105 transition-all duration-300">
        <div className="w-full max-w-xs mx-auto mb-4 aspect-[16/9]">
          <video
            autoPlay
            muted
            loop
            className="w-full h-full object-cover rounded-lg"
            src="/image/first.mp4"
          >
            Your browser does not support the video tag.
          </video>
        </div>
        <h3 className="text-xl font-semibold mb-2">Register Your Ad</h3>
        <p className="text-gray-600 mt-8">Submit your ad content, choose your preferred vehicle type (motorcycle, car, jeepney, bus), and select your campaign duration.</p>
      </div>
      <div className="p-6 rounded-lg shadow-md hover:scale-105 transition-all duration-300">
        <div className="w-full max-w-xs mx-auto mb-4 aspect-[16/9]">
          <video
            autoPlay
            muted
            loop
            className="w-full h-full object-cover rounded-lg"
            src="/image/second.mp4"
          >
            Your browser does not support the video tag.
          </video>
        </div>
        <h3 className="text-xl font-semibold mb-2">Launch Your Campaign</h3>
        <p className="text-gray-600 mt-8">Once approved, your ad goes live on vehicle LCDs or vinyl wraps, reaching thousands daily.</p>
      </div>
      <div className="p-6 rounded-lg shadow-md hover:scale-105 transition-all duration-300">
        <div className="w-full max-w-xs mx-auto mb-4 aspect-[16/9]">
          <video
            autoPlay
            muted
            loop
            className="w-full h-full object-cover rounded-lg"
            src="/image/third.mp4"
          >
            Your browser does not support the video tag.
          </video>
        </div>
        <h3 className="text-xl font-semibold mb-2">View Drivers</h3>
        <p className="text-gray-600 mt-8">Browse available drivers or vehicles based on your preferred route or area. Assign your ad to the one that best fits your goals.</p>
      </div>
      <div className="p-6 rounded-lg shadow-md hover:scale-105 transition-all duration-300">
        <div className="w-full max-w-xs mx-auto mb-4 aspect-[16/9]">
          <video
            autoPlay
            muted
            loop
            className="w-full h-full object-cover rounded-lg"
            src="/image/fourth.mp4"
          >
            Your browser does not support the video tag.
          </video>
        </div>
        <h3 className="text-xl font-semibold mb-2">Track & Monitor Performance</h3>
        <p className="text-gray-600 mt-8">Use the dashboard to track your ad in real-time, view routes, impressions, and get performance reports.</p>
      </div>
    </div>    
  </div>
</section>

      {/* Vehicle Plans Section */}
      <section className="py-16 px-4 bg-[#578FCA] text-white h-96">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12 animate-fadeDown">Pick the perfect ride and plan for your ad</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="bg-gray-50 text-black p-6 rounded-lg shadow-md text-center h-[600px] hover:scale-105 transition-all duration-300">
              <h3 className="text-3xl font-bold mb-2">Motorcycle Plan</h3>
              <p className="text-sm mb-2 text-gray-600 font-bold">Starting at ₱100,000/month</p>
              <Link to="/login">
                <button className="mt-5 mb-4 px-4 py-2 text-sm space-y-2 bg-[#FADA7A] text-black rounded hover:bg-teal-600 transition hover:scale-105 transition-all duration-300">
                  Get Started
                </button>
              </Link>
              <div className="mt-3 space-y-4">
                <p className="text-md">Available in LCD Monitor or Vinyl Sticker</p>
                <p className="text-md">Highly visible in dense traffic and urban areas</p>
                <p className="text-md">Ideal for short-range but high-frequency exposure</p>
                <p className="text-md">Perfect for local businesses, food outlets, and event promotions</p>
                <p className="text-md">GPS tracking included</p>
                <p className="text-md">Targeted routes available upon request</p>
              </div>
            </div>
            <div className="bg-gray-50 text-black p-6 rounded-lg shadow-md text-center h-[600px] hover:scale-105 transition-all duration-300">
              <h3 className="text-3xl font-bold mb-2">Car Plan</h3>
              <p className="text-sm mb-2 text-gray-600 font-bold">Starting at ₱150,000/month</p>
              <Link to="/login">
                <button className="mt-5 mb-4 px-4 py-2 text-sm space-y-2 bg-[#FADA7A]  text-black rounded hover:bg-teal-600 transition hover:scale-105 transition-all duration-300">
                  Get Started
                </button>
              </Link>
              <div className="mt-3 space-y-4">
                <p className="text-md">Equipped with Rear or Side LCD Display / Full-body Vinyl wrap optional</p>
                <p className="text-md">Ideal for city and suburban routes</p>
                <p className="text-md">Balanced exposure and mobility</p>
                <p className="text-md">Suitable for mid-size campaigns or service promotions</p>
                <p className="text-md">Includes scheduling, tracking, and reporting dashboard</p>
                <p className="text-md">Optional: Custom campaign times (rush hour only, etc.)</p>
              </div>
            </div>
            <div className="bg-gray-50 text-black p-6 rounded-lg shadow-md text-center h-[600px] hover:scale-105 transition-all duration-300">
              <h3 className="text-3xl font-bold mb-2">Bus Plan</h3>
              <p className="text-sm mb-2 text-gray-600 font-bold">Starting at ₱300,000/month</p>
              <Link to="/login">
                <button className="mt-5 mb-4 px-4 text-sm py-2 space-y-2 bg-[#FADA7A]  text-black rounded hover:bg-teal-600 transition hover:scale-105 transition-all duration-300">
                  Get Started
                </button>
              </Link>
              <div className="mt-3 space-y-4">
                <p className="text-md">Available in large LCD Monitor or Full-body Vinyl wrap</p>
                <p className="text-md">High visibility due to size and wide routes</p>
                <p className="text-md">Covers main roads, terminals, and high-traffic locations</p>
                <p className="text-md">Excellent for corporate, real estate, or product launches</p>
                <p className="text-md">Long display time per location due to frequent stops</p>
                <p className="text-md">Includes full analytics and route heatmaps</p>
              </div>
            </div>
            <div className="bg-gray-50 text-black p-6 rounded-lg shadow-md text-center h-[600px] hover:scale-105 transition-all duration-300">
              <h3 className="text-3xl font-bold mb-2">Jeepney Plan</h3>
              <p className="text-sm mb-2 text-gray-600 font-bold">Starting at ₱180,000/month</p>
              <Link to="/login">
                <button className="mt-5 mb-4 px-4 text-sm py-2 space-y-2 bg-[#FADA7A] text-black rounded hover:bg-teal-600 transition hover:scale-105 transition-all duration-300">
                  Get Started
                </button>
              </Link>
              <div className="mt-3 space-y-4">
                <p className="text-md">Available in roof-mounted LCD or rear/side vinyl</p>
                <p className="text-md">Covers key community and commuter-heavy routes</p>
                <p className="text-md">Great for mass-market brands and political ads</p>
                <p className="text-md">Includes flexible route assignment (within city zones)</p>
                <p className="text-md">Budget-friendly option for high-volume local engagement</p>
              </div>
            </div>
          </div>
        </div>
      </section>

     {/* Testimonials */}
<section className="py-16 px-4 bg-white mt-[460px]">
  <div className="container mx-auto">
    <h2 className="text-3xl font-bold text-center mb-12 animate-fadeDown">Testimonials</h2>
    <div className="grid md:grid-cols-3 gap-8">
      {testimonials.map((testimonial, index) => (
        <div key={index} className="relative text-center group h-64 flex flex-col justify-end">
          <div className="absolute inset-0">
            <img
              src={testimonial.image}
              alt={testimonial.name}
              className="w-full h-full object-cover opacity-90 group-hover:opacity-70 transition-opacity duration-300"
            />
          </div>
          <div
            className="relative w-96 z-10 p-6 bg-white bg-opacity-90 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 mx-auto cursor-pointer h-36 translate-y-20 hover:scale-105"
            onClick={() => handleTestimonialClick(testimonial)}
          >
            <p className="text-gray-600 italic line-clamp-2 mb-2">" {testimonial.quote} "</p>
            <h3 className="text-lg font-semibold truncate">{testimonial.name}</h3>
            <p className="text-sm text-gray-500 truncate">{testimonial.title}</p>
          </div>
        </div>
      ))}
    </div>
  </div>

  {/* Popup for full testimonial */}
  {selectedTestimonial && (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 transition-opacity duration-300"
      style={{ animation: 'fadeIn 0.3s ease-out forwards' }}
      onClick={handleClosePopup}
    >
      <div 
        className="relative bg-white rounded-lg p-6 w-[90vw] sm:w-[50vw] md:w-[30vw] lg:w-[20vw] max-h-[80vh] overflow-y-auto transition-all duration-300 transform"
        style={{ animation: 'slideUp 0.3s ease-out forwards' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="absolute top-2 right-2 text-gray-600 hover:text-gray-800 transition-colors duration-200 hover:scale-110"
          onClick={handleClosePopup}
        >
          ✕
        </button>
        <div className="relative text-center space-y-4">
          <img
            src={selectedTestimonial.image}
            alt={selectedTestimonial.name}
            className="w-full h-auto object-cover rounded-t-lg transition-opacity duration-300"
            style={{ animation: 'fadeIn 0.4s ease-out forwards' }}
          />
          <div className="relative z-10 p-4 pb-8 space-y-2">
            <p 
              className="text-gray-600 italic transition-opacity duration-300"
              style={{ animation: 'fadeIn 0.5s ease-out forwards' }}
            >
              " {selectedTestimonial.quote} "
            </p>
            <h3 
              className="text-lg font-semibold transition-opacity duration-300"
              style={{ animation: 'fadeIn 0.6s ease-out forwards' }}
            >
              {selectedTestimonial.name}
            </h3>
            <p 
              className="text-sm text-gray-500 transition-opacity duration-300"
              style={{ animation: 'fadeIn 0.7s ease-out forwards' }}
            >
              {selectedTestimonial.title}
            </p>
          </div>
        </div>
      </div>
    </div>
  )}
</section>


      {/* Call to Action */}
      <section className="py-16 px-4 bg-gray-50 text-center mt-14">
        <h2 className="text-5xl font-bold mb-4 animate-fadeDown">Your ads deserve wheels.</h2>
        <p className="text-5xl text-gray-600 mb-6 animate-fadeDown delay-100">Let’s drive it forward.</p>
        <Link to="/login">
          <button className="px-6 py-3 text-sm font-semibold bg-[#FADA7A] text-white border rounded-[8px] hover:bg-[#DF9755] hover:text-black hover:scale-105 transition-all duration-300">
            Register your ads
          </button>
        </Link>
      </section>

      {/* Footer */}
      <footer className="bg-[#3674B5] text-white py-8 px-4">
        <div className="container mx-auto text-left">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="pl-9 text-lg font-semibold mb-2">Ads2Go</h3>
              <p className="pl-9 text-sm mb-2">Copyright © 2025 Ads2Go. All rights reserved.</p>
              <div className="flex space-x-4 pl-9">
                <a href="#" className="hover:text-teal-400"><span className="sr-only">Instagram</span>📸</a>
                <a href="#" className="hover:text-teal-400"><span className="sr-only">Twitter</span>🐦</a>
                <a href="#" className="hover:text-teal-400"><span className="sr-only">YouTube</span>🎥</a>
              </div>
            </div>
            <div>
              <h3 className="pl-9 text-lg font-semibold mb-2">Company</h3>
              <ul className="pl-9 space-y-2">
                <li><a href="#" className="hover:text-teal-400">About Us</a></li>
                <li><a href="#" className="hover:text-teal-400">Blog</a></li>
                <li><a href="#" className="hover:text-teal-400">Contact Us</a></li>
                <li><a href="#" className="hover:text-teal-400">Pricing</a></li>
                <li><a href="#" className="hover:text-teal-400">Testimonials</a></li>
              </ul>
            </div>
            <div>
              <h3 className="pl-9 text-lg font-semibold mb-2">Support</h3>
              <ul className="pl-9 space-y-2">
                <li><a href="#" className="hover:text-teal-400">Help Center</a></li>
                <li><a href="#" className="hover:text-teal-400">Terms of Service</a></li>
                <li><a href="#" className="hover:text-teal-400">Legal</a></li>
                <li><a href="#" className="hover:text-teal-400">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-teal-400">Status</a></li>
              </ul>
            </div>
            <div>
              <h3 className="pl-9 text-lg font-semibold mb-2">Stay up to date</h3>
              <form onSubmit={handleSubmit} className="mt-2">
                <div className="relative">
                  <input
                    type="email"
                    placeholder="Your email address"
                    className="w-full p-2 pl-4 pr-10 bg-[#C9E6F0] text-black rounded focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-black hover:text-teal-400"
                  >
                    ➣
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
        {showPopup && (
          <div className="fixed bottom-4 right-4 bg-[#CBF3F0] text-black p-3 rounded shadow-lg z-50">
            Request sent. Please check your email after a while
          </div>
        )}
      </footer>
    </div>
  );
}