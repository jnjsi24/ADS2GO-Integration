import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Import modal components
import AboutUsModal from '../../components/modals/AboutUsModal';
import ContactUsModal from '../../components/modals/ContactUsModal';
import PricingModal from '../../components/modals/PricingModal';
import TermsOfServiceModal from '../../components/modals/TermsOfServiceModal';
import PrivacyPolicyModal from '../../components/modals/PrivacyPolicyModal';
import LegalModal from '../../components/modals/LegalModal';
import BlogModal from '../../components/modals/BlogModal';
import StatusModal from '../../components/modals/StatusModal';

// Import newsletter service
import { NewsletterService } from '../../services/newsletterService';


export default function Home() {
  const navigate = useNavigate();

  // State for the hero slideshow
  const [currentSlide, setCurrentSlide] = useState(0);

  // State for the popup in the footer
  const [showPopup, setShowPopup] = useState(false);


  // State for newsletter subscription
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterStatus, setNewsletterStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [newsletterMessage, setNewsletterMessage] = useState('');

  // State for modal popups
  const [modalStates, setModalStates] = useState({
    aboutUs: false,
    contactUs: false,
    pricing: false,
    termsOfService: false,
    privacyPolicy: false,
    legal: false,
    blog: false,
    status: false
  });

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


  // Handle newsletter subscription
  const handleNewsletterSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!newsletterEmail.trim()) {
      setNewsletterStatus('error');
      setNewsletterMessage('Please enter your email address');
      return;
    }

    if (!NewsletterService.validateEmail(newsletterEmail)) {
      setNewsletterStatus('error');
      setNewsletterMessage('Please enter a valid email address');
      return;
    }

    setNewsletterStatus('loading');
    setNewsletterMessage('');

    try {
      const result = await NewsletterService.subscribeToNewsletter(newsletterEmail);
      
      if (result.success) {
        setNewsletterStatus('success');
        setNewsletterMessage(result.message);
        setNewsletterEmail(''); // Clear the input
        setShowPopup(true);
        setTimeout(() => setShowPopup(false), 5000); // Hide popup after 5 seconds
      } else {
        setNewsletterStatus('error');
        setNewsletterMessage(result.message);
      }
    } catch (error) {
      setNewsletterStatus('error');
      setNewsletterMessage('Failed to subscribe. Please try again later.');
    }
  };

  // Handle email form submission for the popup (legacy - keeping for compatibility)
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setShowPopup(true);
    setTimeout(() => setShowPopup(false), 3000); // Hide popup after 3 seconds
  };


  // Modal handlers
  const openModal = (modalName: keyof typeof modalStates) => {
    setModalStates(prev => ({ ...prev, [modalName]: true }));
  };

  const closeModal = (modalName: keyof typeof modalStates) => {
    setModalStates(prev => ({ ...prev, [modalName]: false }));
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
                <button className="px-6 py-3 text-sm font-semibold bg-[#F59E0B] text-white border rounded-[8px] hover:bg-[#D97706] hover:scale-105 transition-all duration-300">
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

      {/* Why Ads2Go? Section */}
      <section className="py-16 px-4 bg-white">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl font-bold mb-12 animate-fadeDown">Why Ads2Go?</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <div className="p-6 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105">
              <div className="text-4xl mb-4">💰</div>
              <h3 className="text-xl font-semibold mb-3">Cost-effective vs. billboards</h3>
              <p className="text-[#475569]">Get more exposure for less cost compared to traditional billboard advertising</p>
            </div>
            <div className="p-6 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105">
              <div className="text-4xl mb-4">📍</div>
              <h3 className="text-xl font-semibold mb-3">Targeted routes (GPS tracking)</h3>
              <p className="text-[#475569]">Reach your specific audience with precise GPS tracking and route optimization</p>
            </div>
            <div className="p-6 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105">
              <div className="text-4xl mb-4">⚡</div>
              <h3 className="text-xl font-semibold mb-3">Flexible pricing plans</h3>
              <p className="text-[#475569]">Choose from various vehicle types and pricing options that fit your budget</p>
            </div>
            <div className="p-6 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105">
              <div className="text-4xl mb-4">🚀</div>
              <h3 className="text-xl font-semibold mb-3">Boosts brand awareness fast</h3>
              <p className="text-[#475569]">See immediate results with mobile advertising that reaches thousands daily</p>
            </div>
            <div className="p-6 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105">
              <div className="text-4xl mb-4">💵</div>
              <h3 className="text-xl font-semibold mb-3">Extra income for drivers</h3>
              <p className="text-[#475569]">Drivers earn passive income by displaying ads on their vehicles</p>
            </div>
            <div className="p-6 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105">
              <div className="text-4xl mb-4">📊</div>
              <h3 className="text-xl font-semibold mb-3">Real-time analytics</h3>
              <p className="text-[#475569]">Track performance with detailed reports and route heatmaps</p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 px-4 bg-gray-50 flex items-center justify-center">
  <div className="container mx-auto max-w-screen-xl text-center">
    <h2 className="text-3xl font-bold mb-8 animate-fadeDown">Easily manage your ads in just a few simple steps</h2>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      <div className="p-6 rounded-lg shadow-md hover:scale-105 transition-all duration-300">
        <div className="w-full max-w-xs mx-auto mb-4">
          <img
            className="w-full h-auto rounded-lg"
            src="/image/register-ad-realistic.jpg"
            alt="Person registering ad campaign on laptop with vehicle options visible in background"
          />
        </div>
        <h3 className="text-xl font-semibold mb-2">Register Your Ad</h3>
        <p className="text-gray-600 mt-8">Submit your ad content, choose your preferred vehicle type (motorcycle, car, jeepney, bus), and select your campaign duration.</p>
      </div>
      <div className="p-6 rounded-lg shadow-md hover:scale-105 transition-all duration-300">
        <div className="w-full max-w-xs mx-auto mb-4">
          <img
            className="w-full h-auto rounded-lg"
            src="/image/launch-campaign-realistic.jpg"
            alt="Laptop showing campaign dashboard with Launch Campaign button and vehicles with ads in background"
          />
        </div>
        <h3 className="text-xl font-semibold mb-2">Launch Your Campaign</h3>
        <p className="text-gray-600 mt-8">Once approved, your ad goes live on vehicle LCDs or vinyl wraps, reaching thousands daily.</p>
      </div>
      <div className="p-6 rounded-lg shadow-md hover:scale-105 transition-all duration-300">
        <div className="w-full max-w-xs mx-auto mb-4">
          <img
            className="w-full h-auto rounded-lg"
            src="/image/track-performance-realistic.jpg"
            alt="Laptop showing live campaign monitoring dashboard with analytics and driver locations on map"
          />
        </div>
        <h3 className="text-xl font-semibold mb-2">Track & Monitor Performance</h3>
        <p className="text-gray-600 mt-8">Use the dashboard to track your ad in real-time, view routes, impressions, and get performance reports.</p>
      </div>
    </div>    
  </div>
</section>

      {/* Vehicle Plans Section */}
      <section className="py-16 px-4 bg-[#0EA5E9] text-white">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12 animate-fadeDown">Pick the perfect ride and plan for your ad</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="bg-gray-50 text-black p-6 rounded-lg shadow-md text-center h-[500px] hover:scale-105 transition-all duration-300">
              <h3 className="text-3xl font-bold mb-2">Motorcycle Plan</h3>
              <p className="text-sm mb-2 text-gray-600 font-bold">Starting at ₱100,000/month</p>
              <Link to="/login">
                <button className="mt-5 mb-4 px-4 py-2 text-sm space-y-2 bg-[#F59E0B] text-black rounded hover:bg-[#D97706] transition hover:scale-105 transition-all duration-300">
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
            <div className="bg-gray-50 text-black p-6 rounded-lg shadow-md text-center h-[500px] hover:scale-105 transition-all duration-300">
              <h3 className="text-3xl font-bold mb-2">Car Plan</h3>
              <p className="text-sm mb-2 text-gray-600 font-bold">Starting at ₱150,000/month</p>
              <Link to="/login">
                <button className="mt-5 mb-4 px-4 py-2 text-sm space-y-2 bg-[#F59E0B] text-black rounded hover:bg-[#D97706] transition hover:scale-105 transition-all duration-300">
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
            <div className="bg-gray-50 text-black p-6 rounded-lg shadow-md text-center h-[500px] hover:scale-105 transition-all duration-300">
              <h3 className="text-3xl font-bold mb-2">Bus Plan</h3>
              <p className="text-sm mb-2 text-gray-600 font-bold">Starting at ₱300,000/month</p>
              <Link to="/login">
                <button className="mt-5 mb-4 px-4 text-sm py-2 space-y-2 bg-[#F59E0B] text-black rounded hover:bg-[#D97706] transition hover:scale-105 transition-all duration-300">
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
            <div className="bg-gray-50 text-black p-6 rounded-lg shadow-md text-center h-[500px] hover:scale-105 transition-all duration-300">
              <h3 className="text-3xl font-bold mb-2">Jeepney Plan</h3>
              <p className="text-sm mb-2 text-gray-600 font-bold">Starting at ₱180,000/month</p>
              <Link to="/login">
                <button className="mt-5 mb-4 px-4 text-sm py-2 space-y-2 bg-[#F59E0B] text-black rounded hover:bg-[#D97706] transition hover:scale-105 transition-all duration-300">
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

      {/* For Drivers Section */}
      <section className="py-20 px-4 bg-gradient-to-br from-[#F8FAFC] to-[#E2E8F0] relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-10 left-10 w-32 h-32 bg-[#0EA5E9] rounded-full"></div>
          <div className="absolute top-32 right-20 w-24 h-24 bg-[#F59E0B] rounded-full"></div>
          <div className="absolute bottom-20 left-1/4 w-16 h-16 bg-[#10B981] rounded-full"></div>
          <div className="absolute bottom-32 right-1/3 w-20 h-20 bg-[#0C4A6E] rounded-full"></div>
        </div>
        
        <div className="container mx-auto text-center relative z-10">
          <div className="max-w-4xl mx-auto">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-[#F59E0B] rounded-full mb-6 animate-bounce">
              <span className="text-3xl">🚗</span>
            </div>
            <h2 className="text-5xl font-bold mb-6 animate-fadeDown bg-gradient-to-r from-[#0C4A6E] to-[#0EA5E9] bg-clip-text text-transparent">
              Earn While You Drive
            </h2>
            <p className="text-xl text-[#475569] mb-10 animate-fadeDown delay-100 leading-relaxed">
              Install LCD or vinyl wraps on your vehicle and get paid monthly. 
              <br className="hidden md:block" />
              Turn your daily commute into a money-making opportunity.
            </p>
            
            {/* Benefits Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
              <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105">
                <div className="text-3xl mb-3">💰</div>
                <h3 className="font-semibold text-[#0C4A6E] mb-2">Passive Income</h3>
                <p className="text-sm text-[#475569]">Earn money while doing your regular driving routes</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105">
                <div className="text-3xl mb-3">📱</div>
                <h3 className="font-semibold text-[#0C4A6E] mb-2">Easy Setup</h3>
                <p className="text-sm text-[#475569]">Quick installation with professional support</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105">
                <div className="text-3xl mb-3">📊</div>
                <h3 className="font-semibold text-[#0C4A6E] mb-2">Track Earnings</h3>
                <p className="text-sm text-[#475569]">Monitor your income through our dashboard</p>
    </div>
  </div>

            <Link to="/login">
              <button className="px-10 py-5 text-lg font-semibold bg-[#F59E0B] text-black border rounded-[12px] hover:bg-[#D97706] hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl">
                Register as Driver
        </button>
            </Link>
          </div>
        </div>
</section>

      {/* Call to Action */}
      <section className="py-20 px-4 bg-gradient-to-r from-[#0C4A6E] to-[#0EA5E9] text-white relative overflow-hidden">
        {/* Background Elements */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-full h-full">
            <div className="absolute top-20 left-20 w-40 h-40 border-2 border-white rounded-full"></div>
            <div className="absolute top-40 right-32 w-24 h-24 border-2 border-white rounded-full"></div>
            <div className="absolute bottom-20 left-1/3 w-32 h-32 border-2 border-white rounded-full"></div>
            <div className="absolute bottom-40 right-20 w-16 h-16 border-2 border-white rounded-full"></div>
          </div>
        </div>
        
        <div className="container mx-auto text-center relative z-10">
          <div className="max-w-4xl mx-auto">
            <div className="inline-flex items-center justify-center w-24 h-24 bg-white bg-opacity-20 rounded-full mb-8 animate-pulse">
              <span className="text-4xl">🚀</span>
            </div>
            <h2 className="text-6xl font-bold mb-6 animate-fadeDown">
              Your ads deserve wheels.
            </h2>
            <p className="text-3xl text-white text-opacity-90 mb-10 animate-fadeDown delay-100 font-light">
              Let's drive it forward.
            </p>
            
            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
              <div className="text-center">
                <div className="text-4xl font-bold text-[#F59E0B] mb-2">1000+</div>
                <div className="text-white text-opacity-80">Active Vehicles</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-[#F59E0B] mb-2">50K+</div>
                <div className="text-white text-opacity-80">Daily Impressions</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-[#F59E0B] mb-2">95%</div>
                <div className="text-white text-opacity-80">Client Satisfaction</div>
              </div>
            </div>
            
            <Link to="/login">
              <button className="px-12 py-6 text-xl font-semibold bg-[#F59E0B] text-black border rounded-[12px] hover:bg-[#D97706] hover:scale-105 transition-all duration-300 shadow-2xl hover:shadow-3xl">
                Register your ads
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0C4A6E] text-white py-8 px-4">
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
                <li><button onClick={() => openModal('aboutUs')} className="hover:text-teal-400 text-left">About Us</button></li>
                <li><button onClick={() => openModal('blog')} className="hover:text-teal-400 text-left">Blog</button></li>
                <li><button onClick={() => openModal('contactUs')} className="hover:text-teal-400 text-left">Contact Us</button></li>
                <li><button onClick={() => openModal('pricing')} className="hover:text-teal-400 text-left">Pricing</button></li>
              </ul>
            </div>
            <div>
              <h3 className="pl-9 text-lg font-semibold mb-2">Support</h3>
              <ul className="pl-9 space-y-2">
                <li><Link to="/help" className="hover:text-teal-400">Help Center</Link></li>
                <li><button onClick={() => openModal('termsOfService')} className="hover:text-teal-400 text-left">Terms of Service</button></li>
                <li><button onClick={() => openModal('legal')} className="hover:text-teal-400 text-left">Legal</button></li>
                <li><button onClick={() => openModal('privacyPolicy')} className="hover:text-teal-400 text-left">Privacy Policy</button></li>
                <li><button onClick={() => openModal('status')} className="hover:text-teal-400 text-left">Status</button></li>
              </ul>
            </div>
            <div>
              <h3 className="pl-9 text-lg font-semibold mb-2">Stay up to date</h3>
              <form onSubmit={handleNewsletterSubmit} className="mt-2">
                <div className="relative">
                  <input
                    type="email"
                    placeholder="Your email address"
                    value={newsletterEmail}
                    onChange={(e) => setNewsletterEmail(e.target.value)}
                    className={`w-full p-2 pl-4 pr-10 bg-[#F1F5F9] text-black rounded focus:outline-none ${
                      newsletterStatus === 'error' ? 'border-2 border-red-500' : ''
                    }`}
                    disabled={newsletterStatus === 'loading'}
                  />
                  <button
                    type="submit"
                    disabled={newsletterStatus === 'loading'}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-black hover:text-teal-400 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {newsletterStatus === 'loading' ? '⏳' : '➣'}
                  </button>
                </div>
                {newsletterMessage && (
                  <div className={`mt-2 text-sm pl-4 ${
                    newsletterStatus === 'success' ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {newsletterMessage}
                  </div>
                )}
              </form>
            </div>
          </div>
        </div>
        {showPopup && (
          <div className="fixed bottom-4 right-4 bg-[#DCFCE7] text-black p-3 rounded shadow-lg z-50">
            {newsletterStatus === 'success' ? 'Successfully subscribed! Check your email for confirmation.' : 'Request sent. Please check your email after a while'}
          </div>
        )}
      </footer>

      {/* Modal Components */}
      <AboutUsModal 
        isOpen={modalStates.aboutUs} 
        onClose={() => closeModal('aboutUs')} 
      />
      <ContactUsModal 
        isOpen={modalStates.contactUs} 
        onClose={() => closeModal('contactUs')} 
      />
      <PricingModal 
        isOpen={modalStates.pricing} 
        onClose={() => closeModal('pricing')} 
      />
      <TermsOfServiceModal 
        isOpen={modalStates.termsOfService} 
        onClose={() => closeModal('termsOfService')} 
      />
      <PrivacyPolicyModal 
        isOpen={modalStates.privacyPolicy} 
        onClose={() => closeModal('privacyPolicy')} 
      />
      <LegalModal 
        isOpen={modalStates.legal} 
        onClose={() => closeModal('legal')} 
      />
      <BlogModal 
        isOpen={modalStates.blog} 
        onClose={() => closeModal('blog')} 
      />
      <StatusModal 
        isOpen={modalStates.status} 
        onClose={() => closeModal('status')} 
      />
    </div>
  );
}