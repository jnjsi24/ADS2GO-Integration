import React, { useState, useEffect } from "react";
import { useQuery } from "@apollo/client";
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/solid";
import { 
  FileText, 
  Plus, 
  List, 
  Search, 
  HelpCircle, 
  MessageCircle, 
  Phone, 
  Mail, 
  Clock, 
  CheckCircle,
  ArrowRight,
  BookOpen,
  Headphones,
  Shield,
  Zap
} from "lucide-react";
import CreateReport from "../../components/CreateReport";
import UserReportsList from "../../components/UserReportsList";
import { GET_ALL_FAQS } from "../../graphql/faq/queries/GetAllFAQs";

const FAQItem: React.FC<{ question: string; answer: string; searchQuery?: string }> = ({
  question,
  answer,
  searchQuery = '',
}) => {
  const [open, setOpen] = useState(false);

  // Function to highlight search terms
  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;
    
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <mark key={index} className="bg-yellow-200 px-1 rounded">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <div className="shadow-lg bg-white/70 mb-4 last:mb-0 overflow-hidden transition-all duration-300">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex justify-between items-start py-4 px-6 text-left font-medium text-gray-800
                   hover:text-[#3674B5] bg-white transition-all duration-200 group"
      >
        <div className="flex-1 pr-6">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <p className="text-gray-800 leading-relaxed font-medium">
                {highlightText(question, searchQuery)}
              </p>
            </div>
          </div>
        </div>
        {/* ✅ Chevron Up/Down icon */}
        <div className="flex-shrink-0">
          <div
            className={`rounded-lg transition-all duration-300 ${
              open ? "rotate-180" : "rotate-0"
            }`}
          >
            <ChevronDownIcon className="w-4 h-4 text-black" />
          </div>
        </div>
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ${
          open ? "faq-open" : "faq-closed"
        }`}
      >
        <div className="px-3">
          <div className="p-3">
            <div className="flex items-start">
              <div className="flex-1">
                <p className="text-gray-700 leading-relaxed">
                  {highlightText(answer, searchQuery)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Help: React.FC = () => {
  const [isCreateReportOpen, setIsCreateReportOpen] = useState(false);
  const [showUserReports, setShowUserReports] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredFAQs, setFilteredFAQs] = useState<any[]>([]);

  // Fetch FAQs dynamically
  const { data: faqData, loading: faqLoading, error: faqError } = useQuery(GET_ALL_FAQS, {
    variables: {
      filters: {
        isActive: true
      }
    }
  });

  const handleCreateReportSuccess = () => {
    // You can add a success notification here
    console.log('Report created successfully');
  };

  // Search functionality with debouncing
  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (!searchQuery.trim()) {
        setFilteredFAQs([]);
        return;
      }

      const faqs = faqData?.getAllFAQs?.faqs || [];
      const filtered = faqs.filter((faq: any) => 
        faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
      );
      
      setFilteredFAQs(filtered);
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [searchQuery, faqData]);

  // Get category orders and FAQs
  const faqs = faqData?.getAllFAQs?.faqs || [];
  const categoryOrders = faqData?.getAllFAQs?.categoryOrders || [];

  // Sort categories by order (if categoryOrders exist) or use default order
  const getSortedCategories = (categories: any) => {
    if (categoryOrders.length > 0) {
      // Sort by category order
      return Object.keys(categories).sort((a, b) => {
        const orderA = categoryOrders.find((co: any) => co.category === a)?.order || 999;
        const orderB = categoryOrders.find((co: any) => co.category === b)?.order || 999;
        return orderA - orderB;
      });
    } else {
      // Default order: EVERYONE, ADVERTISERS, DRIVERS
      const defaultOrder = ['EVERYONE', 'ADVERTISERS', 'DRIVERS'];
      return Object.keys(categories).sort((a, b) => {
        const indexA = defaultOrder.indexOf(a);
        const indexB = defaultOrder.indexOf(b);
        return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
      });
    }
  };

  // Group FAQs by category
  const faqsByCategory = faqs.reduce((acc: any, faq: any) => {
    if (!acc[faq.category]) {
      acc[faq.category] = [];
    }
    acc[faq.category].push(faq);
    return acc;
  }, {});

  // Debug logging
  console.log('User Client FAQ Debug:', {
    faqs: faqs.length,
    categoryOrders: categoryOrders.length,
    categoryOrdersData: categoryOrders,
    faqsByCategory: Object.keys(faqsByCategory),
    sortedCategories: getSortedCategories(faqsByCategory)
  });

  // Group filtered FAQs by category
  const filteredFAQsByCategory = filteredFAQs.reduce((acc: any, faq: any) => {
    if (!acc[faq.category]) {
      acc[faq.category] = [];
    }
    acc[faq.category].push(faq);
    return acc;
  }, {});

  const getCategoryTitle = (category: string) => {
    switch (category) {
      case 'ADVERTISERS': return 'For Advertisers:';
      case 'DRIVERS': return 'For Drivers:';
      case 'EVERYONE': return 'For Everyone:';
      default: return category;
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
    {/* Background Image */}
    <div
      className="absolute inset-0 bg-cover bg-center bg-fixed blur-sm brightness-90"
      style={{
        backgroundImage: "url('/image/bg2.jpg')",
      }}
    ></div>
  
    {/* Overlay (optional subtle tint) */}
    <div className="absolute inset-0 bg-white/40 backdrop-blur-xl"></div>
  
    {/* Main Content */}
    <div className="relative min-h-screen bg-transparent pl-64 pr-5">
      {/* ✅ Inline CSS for accordion animation */}
      <style>{`
        .faq-open { max-height: 500px; }
        .faq-closed { max-height: 0; }
      `}</style>
  
      <main className="mx-auto p-6 space-y-10 max-w-7xl" aria-live="polite">
        {/* Hero Section */}
        <section className="relative overflow-hidden">
          <div className="relative px-8 py-16">
            <div className="max-w-xl mx-auto text-center">
              <div className="flex items-center justify-center mb-2">
                <div className="p-3 rounded-2xl">
                  <HelpCircle className="w-8 h-8 text-black/70" />
                </div>
                <h1 className="text-4xl font-bold">Help Center</h1>
              </div>
              <p className="text-md text-black mb-8 max-w-3xl mx-auto leading-relaxed">
                Find answers, get support, and make the most of your Ads2Go experience with our comprehensive help resources.
              </p>
              
              {/* Search Bar */}
              <div className="max-w-2xl mx-auto mb-8">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Search for help articles, FAQs, or topics..."
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="w-full pl-5 pr-6 py-4 text-sm rounded-md border-0 shadow-xl focus:outline-none focus:ring-4 focus:ring-white/30 bg-white/95 backdrop-blur-sm"
                  />
                  <button
                    onClick={() => handleSearch(searchQuery)}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-[#3674B5] text-sm text-white px-6 py-2 rounded-md font-semibold hover:bg-[#2c5a8a] transition-colors shadow-lg"
                  >
                    Search
                  </button>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex flex-wrap justify-center gap-4">
                <button
                  onClick={() => setIsCreateReportOpen(true)}
                  className="flex items-center gap-2 px-6 py-3 bg-white text-[#3674B5] font-semibold hover:bg-blue-50 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1"
                >
                  <Plus className="w-5 h-5" />
                  Create Support Ticket
                </button>
                <button
                  onClick={() => setShowUserReports(!showUserReports)}
                  className="flex items-center gap-2 px-6 py-3 bg-white/80 text-black/70 font-semibold hover:bg-white/30 transition-all backdrop-blur-sm"
                >
                  <List className="w-5 h-5" />
                  {showUserReports ? 'Hide My Tickets' : 'View My Tickets'}
                </button>
              </div>
            </div>
          </div>
        </section>
        
        {/* User Reports Section */}
        {showUserReports && (
          <section className="bg-white/80 shadow-md p-8">
            <div className="flex items-center gap-3 mb-6">
              <h2 className="text-2xl font-bold text-gray-800">Your Support Tickets</h2>
            </div>
            <UserReportsList />
          </section>
        )}

        {/* Support Options */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white/80 shadow-md p-8">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-blue-100 rounded-xl">
                <MessageCircle className="w-6 h-6 text-[#3674B5]" />
              </div>
              <h3 className="text-xl font-bold text-gray-800">Live Chat</h3>
            </div>
            <p className="text-gray-600 mb-4">Get instant help from our support team</p>
            <div className="flex items-center text-sm text-green-600 font-medium">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
              Online now
            </div>
          </div>

          <div className="bg-white/80 shadow-md p-8">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-green-100 rounded-xl">
                <Phone className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-800">Phone Support</h3>
            </div>
            <p className="text-gray-600 mb-4">Call us for immediate assistance</p>
            <div className="text-sm text-gray-500">
              <Clock className="w-4 h-4 inline mr-1" />
              Mon-Fri, 9AM-6PM PST
            </div>
          </div>

          <div className="bg-white/80 shadow-md p-8">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-purple-100 rounded-xl">
                <Mail className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-800">Email Support</h3>
            </div>
            <p className="text-gray-600 mb-4">Send us a detailed message</p>
            <div className="text-sm text-gray-500">
              <Clock className="w-4 h-4 inline mr-1" />
              Response within 24 hours
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="pt-10">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-4">
              <h2 className="text-3xl font-bold text-gray-800">
                {searchQuery ? `Search Results for "${searchQuery}"` : 'Frequently Asked Questions'}
              </h2>
            </div>
            <p className="text-gray-600 text-lg max-w-3xl mx-auto">
              {searchQuery && filteredFAQs.length > 0 ? `Found ${filteredFAQs.length} result${filteredFAQs.length !== 1 ? 's' : ''}` : searchQuery ? 'No results found for your search' : 'Find answers to common questions about our platform and services'}
            </p>
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setFilteredFAQs([]);
                }}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-[#3674B5] hover:text-[#2c5a8a] font-medium transition-colors"
              >
                <CheckCircle className="w-4 h-4" />
                Clear search and show all FAQs
              </button>
            )}
          </div>

          {faqLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#3674B5] mx-auto"></div>
              <p className="mt-4 text-gray-600 text-lg">Loading FAQs...</p>
            </div>
          ) : faqError ? (
            <div className="text-center py-12 text-red-600">
              <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md mx-auto">
                <p className="text-lg font-medium">Error loading FAQs</p>
                <p className="text-sm mt-2">{faqError.message}</p>
              </div>
            </div>
          ) : searchQuery && filteredFAQs.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 max-w-md mx-auto">
                <p className="text-lg">No FAQs found for "{searchQuery}"</p>
                <p className="text-sm mt-2">Try different keywords or check spelling.</p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setFilteredFAQs([]);
                  }}
                  className="mt-3 text-[#3674B5] hover:text-[#578FCA] underline"
                >
                  Show all FAQs
                </button>
              </div>
            </div>
          ) : Object.keys(searchQuery ? filteredFAQsByCategory : faqsByCategory).length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 max-w-md mx-auto">
                <p className="text-lg">No FAQs available at the moment.</p>
                <p className="text-sm mt-2">Please check back later or contact support.</p>
              </div>
            </div>
              ) : (
                <div className="max-w-5xl mx-auto">
                  {getSortedCategories(searchQuery ? filteredFAQsByCategory : faqsByCategory).map((category: string, index: number) => {
                    const categoryFaqs = (searchQuery ? filteredFAQsByCategory : faqsByCategory)[category];
                    return (
                      <div key={category} className={`mb-12 last:mb-0 ${index === 0 ? 'mt-8' : ''}`}>
                        <div className="flex items-center mb-8">
                          <h2 className="text-2xl font-bold ml-6 text-gray-800">
                            {getCategoryTitle(category)}
                          </h2>
                        </div>
                        <div className="space-y-4">
                          {categoryFaqs.map((faq: any) => (
                            <FAQItem
                              key={faq.id}
                              question={faq.question}
                              answer={faq.answer}
                              searchQuery={searchQuery}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
        </section>
      </main>

      {/* Create Report Modal */}
      <CreateReport
        isOpen={isCreateReportOpen}
        onClose={() => setIsCreateReportOpen(false)}
        onSuccess={handleCreateReportSuccess}
      />
    </div>
    </div>
  );
};

export default Help;
