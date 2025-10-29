import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Import modal components
import AboutUsModal from '../../components/modals/AboutUsModal';
import ContactUsModal from '../../components/modals/ContactUsModal';
import PricingModal from '../../components/modals/PricingModal';
import TermsOfServiceModal from '../../components/modals/TermsOfServiceModal';
import PrivacyPolicyModal from '../../components/modals/PrivacyPolicyModal';
import LegalModal from '../../components/modals/LegalModal';
import StatusModal from '../../components/modals/StatusModal';

import LogoLoop from "../../components/LogoLoop";
import HamburgerMenuOverlay from '../../components/HamburgerMenuOverlay';

// Import newsletter service
import { NewsletterService } from '../../services/newsletterService';

export default function Home() {
  const navigate = useNavigate();

  // State for the popup in the footer
  const [showPopup, setShowPopup] = useState(false);

  // State for newsletter subscription
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterStatus, setNewsletterStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [newsletterMessage, setNewsletterMessage] = useState('');
  const [pos, setPos] = useState({ x: 50, y: 50 });

  // State for contact form
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    message: '',
  });
  const [contactStatus, setContactStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [contactMessage, setContactMessage] = useState('');

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

  const techLogos = [
    { src: "/image/Ads2GoLogoText.png", alt: "Vue.js" },
    { src: "/image/orange-logo.png", alt: "AWS" },
    { src: "/image/f.png", alt: "f"},
    { src: "/image/black-logo.png", alt: "Tailwind CSS" },
    { src: "/image/g.png", alt: "G"},
    { src: "/image/blue-logo.png", alt: "MongoDB" },
  ];

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

  // References for sections to observe
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);

  // Add this near the other state declarations
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Hamburger menu items
  const menuItems = [
    {
      label: 'Home',
      onClick: () => document.getElementById('home')?.scrollIntoView({ behavior: 'smooth' }),
    },
    {
      label: 'About Us',
      onClick: () => document.getElementById('about-us')?.scrollIntoView({ behavior: 'smooth' }),
    },
    {
      label: 'Services',
      onClick: () => document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' }),
    },
    {
      label: 'Contact Us',
      onClick: () => document.getElementById('contact-us')?.scrollIntoView({ behavior: 'smooth' }),
    },
  ];

  useEffect(() => {
    if (isTransitioning) {
      const timer = setTimeout(() => {
        setIsTransitioning(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [current, isTransitioning]);

  // IntersectionObserver for scroll animations
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('section-visible');
          } else {
            entry.target.classList.remove('section-visible');
          }
        });
      },
      { threshold: 0.1 }
    );

    sectionRefs.current.forEach((section) => {
      if (section) observer.observe(section);
    });

    return () => {
      sectionRefs.current.forEach((section) => {
        if (section) observer.unobserve(section);
      });
    };
  }, []);

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
        setNewsletterEmail('');
        setShowPopup(true);
        setTimeout(() => setShowPopup(false), 5000);
      } else {
        setNewsletterStatus('error');
        setNewsletterMessage(result.message);
      }
    } catch (error) {
      setNewsletterStatus('error');
      setNewsletterMessage('Failed to subscribe. Please try again later.');
    }
  };

  // Handle contact form submission
  const handleContactSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const { name, email, message } = contactForm;

    if (!name.trim() || !email.trim() || !message.trim()) {
      setContactStatus('error');
      setContactMessage('Please fill out all fields');
      return;
    }

    if (!NewsletterService.validateEmail(email)) {
      setContactStatus('error');
      setContactMessage('Please enter a valid email address');
      return;
    }

    setContactStatus('loading');
    setContactMessage('');

    try {
      const result = await NewsletterService.sendContactMessage({ name, email, message });
      
      if (result.success) {
        setContactStatus('success');
        setContactMessage('Your message has been sent successfully!');
        setContactForm({ name: '', email: '', message: '' });
        setShowPopup(true);
        setTimeout(() => setShowPopup(false), 5000);
      } else {
        setContactStatus('error');
        setContactMessage(result.message || 'Failed to send message. Please try again.');
      }
    } catch (error) {
      setContactStatus('error');
      setContactMessage('Failed to send message. Please try again later.');
    }
  };

  return (
    <div className="min-h-screen relative">
      {/* Inline CSS for scroll animations */}
      <style>
        {`
          .section-hidden {
            opacity: 0;
            transform: translateY(50px);
            transition: opacity 0.6s ease-out, transform 0.6s ease-out;
          }
          .section-visible {
            opacity: 1;
            transform: translateY(0);
          }
          .section-delay-1 { transition-delay: 0.2s; }
          .section-delay-2 { transition-delay: 0.4s; }
          .section-delay-3 { transition-delay: 0.4s; }
          .section-delay-4 { transition-delay: 0.4s; }
          .section-delay-5 { transition-delay: 0.4s; }
          .section-delay-6 { transition-delay: 0.4s; }
        `}
      </style>

      {/* Header Section */}
      <header className="fixed top-0 left-0 w-full backdrop-blur-md bg-white/10 border-b border-white/20 text-white shadow-lg z-[1002]">
        <div className="container mx-auto max-w-screen-xl px-4 py-4 flex items-center justify-between relative">
          <img src="/image/Ads2GoLogoText.png" alt="Ads2Go" className="h-8 sm:h-10 w-auto z-[1003]" />

          {/* Hamburger Menu for Mobile */}
          {isMobile && (
            <HamburgerMenuOverlay
              items={menuItems}
              buttonTop="32px"
              buttonLeft="calc(100% - 48px)"
              buttonSize="md"
              buttonColor="#ffffff"
              overlayBackground="rgba(255, 255, 255, 0.95)"
              textColor="#000000"
              fontSize="md"
              fontFamily="Inter, sans-serif"
              fontWeight="semibold"
              animationDuration={0.8}
              staggerDelay={0.1}
              menuAlignment="left"
              keepOpenOnItemClick={false}
              ariaLabel="Main navigation menu"
              zIndex={1000}
              enableBlur={true}
            />
          )}

          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-6 md:space-x-8 z-[1003]">
            <button
              onClick={() => document.getElementById('home')?.scrollIntoView({ behavior: 'smooth' })}
              className="text-base md:text-lg text-black/90 hover:text-[#F59E0B] transition-colors duration-300"
            >
              Home
            </button>
            <button
              onClick={() => document.getElementById('about-us')?.scrollIntoView({ behavior: 'smooth' })}
              className="text-base md:text-lg text-black/90 hover:text-[#F59E0B] transition-colors duration-300"
            >
              About Us
            </button>
            <button
              onClick={() => document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' })}
              className="text-base md:text-lg text-black/90 hover:text-[#F59E0B] transition-colors duration-300"
            >
              Services
            </button>
            <button
              onClick={() => document.getElementById('contact-us')?.scrollIntoView({ behavior: 'smooth' })}
              className="text-base md:text-lg text-black/90 hover:text-[#F59E0B] transition-colors duration-300"
            >
              Contact Us
            </button>
          </nav>
        </div>
      </header>

      <section
        id="home"
        ref={(el) => (sectionRefs.current[0] = el)}
        className="section-hidden section-delay-1 relative pt-16 sm:pt-20 pb-12 sm:pb-20 px-4 text-white min-h-[70vh] sm:min-h-[90vh] flex items-center overflow-hidden"
      >
        <img
          src="/image/landing.jpg"
          alt="Hero background"
          className="absolute top-0 left-0 w-full h-full object-cover z-0"
        />
        <div className="absolute inset-0 bg-black/40 z-0"></div>
        
        <div className="container mx-auto max-w-screen-xl relative z-10">
          <div className="max-w-full sm:max-w-4xl text-left px-4 sm:pl-8 md:pl-5">
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 animate-fadeDown">
              Capture Attention Where It Counts — On the Move
            </h1>
            <p className="text-sm sm:text-base md:text-lg mb-6 sm:mb-8 animate-fadeDown delay-100">
              Boost your brand with mobile advertising that turns every ride into a powerful marketing opportunity. 
              Reach your audience wherever they go, ensuring your message travels farther than ever before. 
              Drive visibility, engagement, and measurable growth — anytime, anywhere.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link to="/login">
                <button className="px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base font-semibold bg-[#3674B5] text-white hover:bg-[#1B5087] hover:scale-105 transition-all duration-300">
                  + Register Ad Campaign
                </button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section
        id="about-us"
        ref={(el) => (sectionRefs.current[1] = el)}
        className="section-hidden section-delay-2 py-12 sm:py-16 px-4 bg-white"
      >
        <div className="container mx-auto max-w-screen-xl">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4 animate-fadeDown text-gray-900 text-left">
            Why Ads2Go?
          </h2>
          <h3 className="text-xl sm:text-2xl text-black mb-8 sm:mb-12 max-w-2xl text-left">
            Perfect for your business
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 sm:gap-6 max-w-7xl mx-auto">
            {[
              {
                title: "Cost-effective vs. billboards",
                desc: "Get more exposure for less cost compared to traditional billboard advertising",
                img: "/image/i1.gif",
              },
              {
                title: "Targeted routes (GPS tracking)",
                desc: "Reach your specific audience with precise GPS tracking and route optimization",
                img: "/image/i2.gif",
              },
              {
                title: "Boosts brand awareness fast",
                desc: "See immediate results with mobile advertising that reaches thousands daily",
                img: "/image/i3.gif",
              },
              {
                title: "Extra income for drivers",
                desc: "Drivers earn passive income by displaying ads on their vehicles",
                img: "/image/i4.gif",
              },
              {
                title: "Real-time analytics",
                desc: "Track performance with detailed reports and route heatmaps",
                img: "/image/i5.gif",
              },
            ].map((card, i) => (
              <div
                key={i}
                className="p-4 sm:p-6 shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105 bg-gradient-to-br from-gray-50 to-white relative flex flex-col items-center text-center"
              >
                <div className="absolute top-4 left-4 w-12 sm:w-16 h-12 sm:h-16">
                  <img
                    src={card.img}
                    alt={card.title}
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="pt-12 sm:pt-16 pb-6 flex-1 flex flex-col items-center mt-5 justify-center">
                  <h3 className="text-base sm:text-lg font-semibold mb-2 text-left text-gray-900">{card.title}</h3>
                  <p className="text-[#475569] text-sm sm:text-base leading-relaxed text-left">{card.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        ref={(el) => (sectionRefs.current[2] = el)}
        className="section-hidden section-delay-3 bg-gray-50 py-8"
      >
        <h2 className="text-2xl sm:text-3xl font-bold pt-2 text-center">Our Advertisers Partner</h2>
        <div className="max-w-6xl mx-auto px-4">
          <LogoLoop
            logos={techLogos}
            speed={40}
            gap={60}
            pauseOnHover={true}
            fadeOut={true}
            fadeOutColor="#f9fafb"
          />
        </div>
      </section>

      <section
        ref={(el) => (sectionRefs.current[3] = el)}
        className="section-hidden section-delay-4 py-12 sm:py-20 px-4 bg-white"
      >
        <div className="container mx-auto max-w-screen-xl">
          <div className="flex flex-col md:flex-row-reverse gap-6 sm:gap-8">
            <div className="md:w-1/2">
              <h3 className="text-2xl sm:text-3xl md:text-4xl font-semibold mb-4 sm:mb-6">About Us</h3>
              <p className="text-base sm:text-lg text-[#475569] mb-4 sm:mb-6 leading-relaxed">
                At Ads2Go, we revolutionize advertising by bringing brands to the streets. Our mission is to create dynamic, 
                mobile advertising solutions that connect businesses with their audiences in innovative ways. Using cutting-edge 
                technology like GPS tracking and LCD displays, we ensure your message reaches the right people at the right time.
              </p>
              <p className="text-sm sm:text-md text-[#475569]">
                Founded in the Philippines, we empower drivers to earn extra income while helping businesses amplify their reach. 
                Join us in transforming the way advertising moves.
              </p>
            </div>
            <div className="md:w-1/2">
              <img
                src="/image/about.jpg"
                alt="About Ads2Go"
                className="w-full h-64 sm:h-80 object-cover shadow-md"
              />
            </div>
          </div>
        </div>
      </section>

      <section
        id="services"
        ref={(el) => (sectionRefs.current[4] = el)}
        className="section-hidden section-delay-5 py-12 sm:py-16 px-4 bg-white flex items-center justify-center"
      >
        <div className="container mx-auto max-w-screen-xl text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-8 sm:mb-12">
            Launch Ads in 3 Steps
          </h2>
          <div className="flex flex-col sm:flex-row justify-center items-start gap-6 sm:gap-10">
            {[
              {
                img: "/image/L1.jpg",
                title: "Register Your Ad",
                desc: "Submit your ad content, choose your preferred vehicle type (motorcycle, car, jeepney, bus), and select your campaign duration.",
              },
              {
                img: "/image/L2.jpg",
                title: "Launch Your Campaign",
                desc: "Once approved, your ad goes live on vehicle LCDs or vinyl wraps, reaching thousands daily.",
              },
              {
                img: "/image/L3.jpg",
                title: "Track & Monitor Performance",
                desc: "Use the dashboard to track your ad in real-time, view routes, impressions, and get performance.",
              },
            ].map((card, i) => (
              <div
                key={i}
                className="relative w-full sm:w-80 max-w-full h-96 transition-transform duration-500 hover:scale-[1.03] flex-shrink-0"
              >
                <img
                  className="absolute top-0 left-0 w-full h-56 sm:h-64 object-cover shadow-md z-0"
                  src={card.img}
                  alt={card.title}
                />
                <div
                  className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 bg-white/90 shadow-xl z-10 mx-2 sm:mx-3 transform -translate-y-4 text-left"
                  style={{ height: '170px' }}
                >
                  <h3 className="text-lg sm:text-xl font-bold mb-2 sm:mb-3">{card.title}</h3>
                  <p className="text-gray-600 text-sm sm:text-base">{card.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        ref={(el) => (sectionRefs.current[5] = el)}
        className="section-hidden section-delay-6"
      >
        {/* Testimonials section removed - no real data available */}
      </section>

      <section
        id="contact-us"
        ref={(el) => (sectionRefs.current[6] = el)}
        className="section-hidden section-delay-6 py-12 sm:py-20 px-4 bg-white"
      >
        <div className="container mx-auto max-w-screen-xl">
          <div className="flex flex-col md:flex-row gap-6 sm:gap-8">
            <div className="md:w-1/2">
              <h3 className="text-xl sm:text-2xl font-semibold mb-4">Get in Touch</h3>
              <p className="text-base sm:text-lg text-[#475569] mb-4 sm:mb-6 leading-relaxed">
                Have questions about our mobile advertising solutions or want to join as a driver? 
                Reach out to our team, and we’ll get back to you as soon as possible. 
                Your feedback and inquiries are important to us!
              </p>
              <p className="text-sm sm:text-md">
                Email: <a href="mailto:support@ads2go.com" className="transition-colors duration-300">support@ads2go.com</a><br />
                Phone: <a href="tel:+1234567890" className="transition-colors duration-300">+1 (234) 567-890</a>
              </p>
            </div>
            <div className="md:w-1/2">
              <h3 className="text-xl font-semibold mb-2">Contact Us</h3>
              <form onSubmit={handleContactSubmit} className="mt-2">
                <div className="mb-4">
                  <label htmlFor="contact-name" className="block text-sm font-medium mb-1">
                    Name
                  </label>
                  <input
                    id="contact-name"
                    type="text"
                    value={contactForm.name}
                    onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                    placeholder="Your name"
                    className={`w-full p-2 pl-4 text-black focus:outline-none ${
                      contactStatus === 'error' && !contactForm.name.trim() ? 'border-2 border-red-500' : ''
                    }`}
                    style={{
                      WebkitBoxShadow: '0 0 0 1000px #F1F5F9 inset',
                      WebkitTextFillColor: '#000000'
                    }}
                    disabled={contactStatus === 'loading'}
                  />
                </div>
                <div className="mb-4">
                  <label htmlFor="contact-email" className="block text-sm font-medium mb-1">
                    Email
                  </label>
                  <input
                    id="contact-email"
                    type="email"
                    value={contactForm.email}
                    onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                    placeholder="Your email address"
                    className={`w-full p-2 pl-4 pr-10 text-black focus:outline-none ${
                      contactStatus === 'error' && !contactForm.email.trim() ? 'border-2 border-red-500' : ''
                    }`}
                    style={{
                      WebkitBoxShadow: '0 0 0 1000px #F1F5F9 inset',
                      WebkitTextFillColor: '#000000',
                    }}
                    disabled={contactStatus === 'loading'}
                  />
                </div>
                <div className="mb-4">
                  <label htmlFor="contact-message" className="block text-sm font-medium mb-1">
                    Message
                  </label>
                  <textarea
                    id="contact-message"
                    value={contactForm.message}
                    onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                    placeholder="Your message"
                    className={`w-full p-2 pl-4 text-black focus:outline-none h-24 sm:h-32 resize-y ${
                      contactStatus === 'error' && !contactForm.message.trim() ? 'border-2 border-red-500' : ''
                    }`}
                    style={{
                      WebkitBoxShadow: '0 0 0 1000px #F1F5F9 inset',
                      WebkitTextFillColor: '#000000'
                    }}
                    disabled={contactStatus === 'loading'}
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={contactStatus === 'loading'}
                    onMouseMove={(e) => {
                      if (contactStatus === 'loading') return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      const x = ((e.clientX - rect.left) / rect.width) * 100;
                      const y = ((e.clientY - rect.top) / rect.height) * 100;
                      setPos({ x, y });
                    }}
                    className={`relative group inline-flex items-center justify-center overflow-hidden
                                mt-6 py-2 rounded-md font-semibold text-white transition-all duration-300
                                ${contactStatus === 'loading'
                                  ? "bg-gray-400 cursor-not-allowed"
                                  : "hover:scale-105"
                                }`}
                    style={contactStatus === 'loading' ? {} : {
                      backgroundImage: `linear-gradient(to right, #1B5087 0%, #3674B5 100%),
                                        radial-gradient(circle at ${pos.x}% ${pos.y}%, rgba(173,216,230,0), rgba(173,216,230,0))`,
                    }}
                  >
                    <span className="inline-flex items-center gap-2 px-6">
                      {contactStatus === 'loading' ? "Processing..." : "Send"}
                    </span>
                    {contactStatus !== 'loading' && (
                      <span
                        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                        style={{
                          background: `radial-gradient(circle at ${pos.x}% ${pos.y}%, rgba(255,255,255,0.25), transparent 60%)`,
                        }}
                      />
                    )}
                  </button>
                </div>
                {contactMessage && (
                  <div
                    className={`mt-2 text-sm pl-4 ${
                      contactStatus === 'success' ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {contactMessage}
                  </div>
                )}
              </form>
            </div>
          </div>
        </div>
      </section>

      <footer className="relative bg-gradient-to-br from-[#1B5087] to-[#3674B5] overflow-hidden text-white pt-6 px-4">
        <div className="absolute inset-0 bg-black/20 backdrop-blur-sm z-0"></div>
        <div className="relative z-10 container mx-auto max-w-screen-xl">
          {/* Top Row: Logo + Description | Navigation Links */}
          <div className="flex flex-col lg:flex-row justify-between items-center lg:items-start gap-8 mb-6">
            {/* Left: Logo and Description */}
            <div className="flex flex-col space-y-4 text-center lg:text-left">
              <div className="flex items-center justify-center lg:justify-start gap-3">
                <img 
                  src="/image/Ads2GoLogoText.png" 
                  alt="Ads2Go Logo" 
                  className="h-12 w-32"
                />
              </div>
              <p className="text-sm text-white/80 max-w-md mx-auto lg:mx-0">
                Transforming advertising through innovative digital solutions. Reach your audience wherever they go with our dynamic ad platform.
              </p>
            </div>

            {/* Right: Navigation Links - Horizontally aligned with logo */}
            <div className="flex items-center justify-center lg:justify-end">
              <div className="flex flex-col items-center lg:items-end gap-3">
                {/* Navigation Links */}
                <div className="flex flex-wrap justify-center lg:justify-end gap-4 mb-10">
                  <button id="about-us" className="hover:text-white/70 text-lg">About</button>
                  <button id="blog" className="hover:text-white/70 text-lg">Blog</button>
                  <button id="help-center" className="hover:text-white/70 text-lg">Help Center</button>
                  <button id="contact-us" className="hover:text-white/70 text-lg">Contact Us</button>
                </div>

                {/* Copyright (below navigation) */}
                <div className="text-sm text-white/70 text-center lg:text-right">
                  Copyright © 2025 Ads2Go. All rights reserved.
                </div>
              </div>
            </div>
          </div>
        </div>

        {showPopup && (
          <div className="fixed bottom-4 right-4 bg-[#DCFCE7] text-black p-3 rounded shadow-lg z-50 max-w-[90%] sm:max-w-md">
            {newsletterStatus === 'success'
              ? 'Successfully subscribed! Check your email for confirmation.'
              : contactStatus === 'success'
              ? 'Message sent successfully!'
              : 'Request sent. Please check your email after a while'}
          </div>
        )}
      </footer>
    </div>
  );
}