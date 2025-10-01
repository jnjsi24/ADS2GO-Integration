import React, { useState } from 'react';
import { NewsletterService } from '../../services/newsletterService';

interface BlogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const BlogModal: React.FC<BlogModalProps> = ({ isOpen, onClose }) => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      setStatus('error');
      setMessage('Please enter your email address');
      return;
    }

    if (!NewsletterService.validateEmail(email)) {
      setStatus('error');
      setMessage('Please enter a valid email address');
      return;
    }

    setStatus('loading');
    setMessage('');

    try {
      const result = await NewsletterService.subscribeToNewsletter(email);
      
      if (result.success) {
        setStatus('success');
        setMessage(result.message);
        setEmail(''); // Clear the input
      } else {
        setStatus('error');
        setMessage(result.message);
      }
    } catch (error) {
      setStatus('error');
      setMessage('Failed to subscribe. Please try again later.');
    }
  };

  if (!isOpen) return null;

  const blogPosts = [
    {
      id: 1,
      title: "The Future of Mobile Advertising in the Philippines",
      excerpt: "Exploring how mobile advertising is transforming the marketing landscape in the Philippines and what it means for businesses.",
      date: "January 15, 2025",
      category: "Industry Insights",
      readTime: "5 min read",
      image: "/image/blog1.jpg"
    },
    {
      id: 2,
      title: "Maximizing ROI with Vehicle-Based Advertising",
      excerpt: "Learn proven strategies to get the most out of your mobile advertising campaigns and achieve better returns on investment.",
      date: "January 10, 2025",
      category: "Marketing Tips",
      readTime: "7 min read",
      image: "/image/blog2.jpg"
    },
    {
      id: 3,
      title: "Driver Success Stories: Real Income from Mobile Ads",
      excerpt: "Discover how our drivers are earning additional income while helping businesses reach their target audiences.",
      date: "January 5, 2025",
      category: "Success Stories",
      readTime: "4 min read",
      image: "/image/blog3.jpg"
    },
    {
      id: 4,
      title: "Digital vs Traditional Advertising: A Complete Comparison",
      excerpt: "Compare the effectiveness of digital mobile advertising against traditional advertising methods in today's market.",
      date: "December 28, 2024",
      category: "Industry Insights",
      readTime: "6 min read",
      image: "/image/blog4.jpg"
    },
    {
      id: 5,
      title: "Creating Compelling Ad Content for Mobile Displays",
      excerpt: "Best practices and tips for designing advertisements that capture attention and drive action on mobile displays.",
      date: "December 20, 2024",
      category: "Design Tips",
      readTime: "8 min read",
      image: "/image/blog5.jpg"
    },
    {
      id: 6,
      title: "Understanding Mobile Advertising Analytics",
      excerpt: "A comprehensive guide to interpreting your mobile advertising performance data and making data-driven decisions.",
      date: "December 15, 2024",
      category: "Analytics",
      readTime: "9 min read",
      image: "/image/blog6.jpg"
    }
  ];

  const categories = ["All", "Industry Insights", "Marketing Tips", "Success Stories", "Design Tips", "Analytics"];

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
            <h2 className="text-3xl font-bold text-[#3674B5] mb-4">Ads2Go Blog</h2>
            <p className="text-gray-600 text-lg">Insights, tips, and stories from the world of mobile advertising</p>
          </div>

          {/* Category Filter */}
          <div className="flex flex-wrap justify-center gap-2">
            {categories.map((category) => (
              <button
                key={category}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200 ${
                  category === "All" 
                    ? "bg-[#3674B5] text-white" 
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          {/* Featured Post */}
          <div className="bg-gradient-to-r from-[#3674B5] to-[#2c5a8a] text-white rounded-lg p-8">
            <div className="flex items-center mb-4">
              <span className="bg-[#FADA7A] text-black px-3 py-1 rounded-full text-sm font-semibold">
                Featured
              </span>
              <span className="ml-4 text-sm opacity-90">{blogPosts[0].date}</span>
            </div>
            <h3 className="text-2xl font-bold mb-3">{blogPosts[0].title}</h3>
            <p className="text-lg opacity-90 mb-4">{blogPosts[0].excerpt}</p>
            <div className="flex items-center justify-between">
              <span className="text-sm opacity-75">{blogPosts[0].readTime}</span>
              <button className="bg-[#FADA7A] text-black px-6 py-2 rounded-md font-semibold hover:bg-[#DF9755] transition-colors duration-200">
                Read More
              </button>
            </div>
          </div>

          {/* Blog Posts Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {blogPosts.slice(1).map((post) => (
              <article key={post.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-all duration-300">
                <div className="h-48 bg-gray-200 flex items-center justify-center">
                  <span className="text-gray-500">📰</span>
                </div>
                <div className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-xs font-semibold">
                      {post.category}
                    </span>
                    <span className="text-xs text-gray-500">{post.readTime}</span>
                  </div>
                  
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
                    {post.title}
                  </h3>
                  
                  <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                    {post.excerpt}
                  </p>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">{post.date}</span>
                    <button className="text-[#3674B5] text-sm font-semibold hover:text-[#2c5a8a] transition-colors duration-200">
                      Read More →
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {/* Newsletter Signup */}
          <div className="bg-gray-50 rounded-lg p-8 text-center">
            <h3 className="text-2xl font-bold text-[#3674B5] mb-4">Stay Updated</h3>
            <p className="text-gray-600 mb-6">
              Subscribe to our newsletter for the latest insights, tips, and updates from the mobile advertising world.
            </p>
            <form onSubmit={handleNewsletterSubmit} className="max-w-md mx-auto">
              <div className="flex">
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`flex-1 px-4 py-3 border rounded-l-md focus:outline-none focus:ring-2 focus:ring-[#3674B5] focus:border-transparent ${
                    status === 'error' ? 'border-red-500' : 'border-gray-300'
                  }`}
                  disabled={status === 'loading'}
                />
                <button 
                  type="submit"
                  disabled={status === 'loading'}
                  className="bg-[#3674B5] text-white px-6 py-3 rounded-r-md font-semibold hover:bg-[#2c5a8a] transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {status === 'loading' ? '⏳' : 'Subscribe'}
                </button>
              </div>
              {message && (
                <div className={`mt-3 text-sm ${
                  status === 'success' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {message}
                </div>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BlogModal;
