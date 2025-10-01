import React, { useState, useEffect } from "react";
import { useQuery } from "@apollo/client";
// ✅ If you already use lucide-react or heroicons, adjust import accordingly.
// Here we use Heroicons outline set:
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/solid";
import { FileText, Plus, List } from "lucide-react";
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
    <div className="border-b border-gray-200 last:border-b-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex justify-between items-center py-4 px-2 text-left font-medium text-[#2E2E2E]
                   hover:text-[#3674B5] hover:bg-gray-50 rounded-lg transition-all duration-200 group"
      >
        <div className="flex-1 pr-4">
          <span className="text-sm font-semibold text-[#3674B5] italic">Question:</span>
          <p className="text-gray-800 mt-1 leading-relaxed">
            {highlightText(question, searchQuery)}
          </p>
        </div>
        {/* ✅ Chevron Up/Down icon */}
        <span
          className={`transition-transform duration-300 text-gray-400 group-hover:text-[#3674B5] ${
            open ? "rotate-180" : "rotate-0"
          }`}
        >
          <ChevronDownIcon className="w-5 h-5" />
        </span>
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ${
          open ? "faq-open" : "faq-closed"
        }`}
      >
        <div className="px-2 pb-4">
          <div className="bg-blue-50 border-l-4 border-[#3674B5] rounded-r-lg p-4">
            <span className="text-sm font-semibold text-[#3674B5] italic">Answer:</span>
            <p className="text-gray-700 mt-2 leading-relaxed">
              {highlightText(answer, searchQuery)}
            </p>
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
    <div className="min-h-screen bg-white pl-64 pr-5">
      {/* ✅ Inline CSS for accordion animation */}
      <style>{`
        .faq-open { max-height: 500px; }
        .faq-closed { max-height: 0; }
      `}</style>

      <main className="mx-auto p-6 space-y-10 max-w-7xl" aria-live="polite">
        {/* Create Report Section - Moved to top */}
        <section className="rounded-2xl p-6 bg-gradient-to-r from-[#3674B5] to-[#578FCA] text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <FileText className="w-8 h-8" />
              <div>
                <h1 className="text-3xl font-bold">Need Help?</h1>
                <p className="text-blue-100">Can't find what you're looking for? Create a report and we'll help you out.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowUserReports(!showUserReports)}
                className="flex items-center gap-2 px-4 py-3 bg-white bg-opacity-20 text-white rounded-lg font-semibold hover:bg-opacity-30 transition-colors"
              >
                <List className="w-5 h-5" />
                {showUserReports ? 'Hide My Reports' : 'View My Reports'}
              </button>
              <button
                onClick={() => setIsCreateReportOpen(true)}
                className="flex items-center gap-2 px-6 py-3 bg-white text-[#3674B5] rounded-lg font-semibold hover:bg-blue-50 transition-colors shadow-lg hover:shadow-xl"
              >
                <Plus className="w-5 h-5" />
                Create Report
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="bg-white bg-opacity-10 rounded-lg p-4">
              <h3 className="font-semibold mb-2">Bug Reports</h3>
              <p className="text-sm text-blue-100">Report technical issues or bugs you encounter</p>
            </div>
            <div className="bg-white bg-opacity-10 rounded-lg p-4">
              <h3 className="font-semibold mb-2">Feature Requests</h3>
              <p className="text-sm text-blue-100">Suggest new features or improvements</p>
            </div>
            <div className="bg-white bg-opacity-10 rounded-lg p-4">
              <h3 className="font-semibold mb-2">General Support</h3>
              <p className="text-sm text-blue-100">Ask questions or get help with your account</p>
            </div>
          </div>
        </section>

        {/* User Reports Section */}
        {showUserReports && (
          <section className="space-y-4">
            <UserReportsList />
          </section>
        )}

        {/* Spacer */}
        <div className="h-16"></div>

        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-4xl mt-5 font-bold text-black mb-2">
            Hello, how can we help you today?
          </h1>
          <p className="text-sm text-gray-500 max-w-lg mx-auto mt-2 leading-relaxed">
            Browse the information and frequently asked questions below to
            quickly find the detailed help you need. Our comprehensive guides
            provide clear, step-by-step solutions for common questions.
          </p>
              <div className="flex justify-center">
                <div className="relative w-screen max-w-md mt-8">
                  <input
                    type="text"
                    placeholder="Ask a question..."
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="text-xs text-black rounded-lg pl-5 pr-20 py-3 w-full shadow-md focus:outline-none focus:ring-2 focus:ring-[#3674B5] bg-white"
                  />
                  <button
                    onClick={() => handleSearch(searchQuery)}
                    className="absolute right-1 top-1/2 -translate-y-1/2 bg-[#feb011] text-white text-sm rounded-lg px-4 py-1.5
                               hover:bg-[#FF9B45] hover:scale-105 transition-all duration-300"
                  >
                    Search
                  </button>
                </div>
              </div>
            </div>

            {/* Spacer between search and FAQ */}
            <div className="h-8"></div>

            {/* FAQ with chevron animation */}
            <section className="bg-white rounded-2xl shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-3 text-[#3674B5]">
              {searchQuery ? `Search Results for "${searchQuery}"` : 'Frequently Asked Questions'}
            </h1>
            <p className="text-gray-600 text-lg">
              {searchQuery && filteredFAQs.length > 0 ? `Found ${filteredFAQs.length} result${filteredFAQs.length !== 1 ? 's' : ''}` : searchQuery ? '' : 'Find answers to common questions about our platform'}
            </p>
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setFilteredFAQs([]);
                }}
                className="mt-3 text-[#3674B5] hover:text-[#578FCA] underline text-sm"
              >
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
                <div className="max-w-4xl mx-auto">
                  {getSortedCategories(searchQuery ? filteredFAQsByCategory : faqsByCategory).map((category: string, index: number) => {
                    const categoryFaqs = (searchQuery ? filteredFAQsByCategory : faqsByCategory)[category];
                    return (
                      <div key={category} className={`mb-8 last:mb-0 ${index === 0 ? 'mt-24' : ''}`}>
                        <div className="flex items-center mb-6">
                          <div className="h-1 bg-gradient-to-r from-[#3674B5] to-[#578FCA] w-16 rounded-full"></div>
                          <h2 className="text-2xl font-bold ml-4 text-gray-800">
                            {getCategoryTitle(category)}
                          </h2>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-6 shadow-sm">
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
  );
};

export default Help;
