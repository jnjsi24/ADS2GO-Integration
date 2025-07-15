import React, { useState, useEffect } from 'react';

type Section = 'help' | 'about' | 'privacy' | 'terms';

const icons = {
  about: (
    <svg
      className="inline-block mr-2 w-5 h-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),
  privacy: (
    <svg
      className="inline-block mr-2 w-5 h-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 1L3 5v6c0 5 3.8 9.8 9 11 5.2-1.2 9-6 9-11V5l-9-4z" />
      <circle cx="12" cy="11" r="2" />
    </svg>
  ),
  terms: (
    <svg
      className="inline-block mr-2 w-5 h-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 12h6m-6 4h6M5 7h14M5 19h14" />
    </svg>
  ),
  help: (
    <svg
      className="inline-block mr-2 w-5 h-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 1 1 5.82 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
};

const Help: React.FC = () => {
  const [activeSection, setActiveSection] = useState<Section>('about');
  const [fade, setFade] = useState(true);

  useEffect(() => {
    setFade(false);
    const timer = setTimeout(() => setFade(true), 150);
    return () => clearTimeout(timer);
  }, [activeSection]);

  const navItem = (label: string, section: Section) => (
    <li
      key={section}
      className={`flex items-center px-4 py-2 rounded-lg cursor-pointer hover:scale-105 transition-all duration-300 select-none
        ${
          activeSection === section
            ? 'bg-[#3674B5] text-white font-semibold shadow-md'
            : 'text-[#0A192F] hover:bg-[#3674B5] hover:text-white focus:outline-none focus:ring-2 focus:ring-[#2EC4B6]'
        }`}
      onClick={() => setActiveSection(section)}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') setActiveSection(section);
      }}
      role="button"
      aria-current={activeSection === section ? 'page' : undefined}
    >
      {icons[section]}
      {label}
    </li>
  );

  return (
    <div className="min-h-screen pl-60 pt-5 bg-white font-sans flex">
      {/* Main content area with left margin for sidebar width (w-64 = 256px) */}
      <div className="flex-1 flex flex-col">
        <main
          className={`mx-auto p-6 space-y-8 transition-opacity duration-300 ${
            fade ? 'opacity-100' : 'opacity-0'
          }`}
          aria-live="polite"
        >
          {/* Header Container Centered */}
          <div className="flex justify-center">
            <div className="text-center mb-6">
              <h1 className="text-4xl font-bold text-black mb-2">Hello, how can we help?</h1>
              <div className="flex justify-center items-center space-x-2">
                <input
                  type="text"
                  placeholder="Ask a question..."
                  className="border border-gray-300 rounded-lg p-2 w-64 focus:outline-none"
                />
                <button className="bg-[#F3A26D] text-black rounded-lg px-4 py-2 hover:bg-[#578FCA] hover:scale-105 transition-all duration-300">
                  Search
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-2">or choose a category to quickly find the help you need</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav aria-label="Help sections" className="mb-6">
            <ul className="flex justify-center space-x-4 border-b border-gray-300 pb-2">
              {navItem('About Us', 'about')}
              {navItem('Privacy Policy', 'privacy')}
              {navItem('Terms and Conditions', 'terms')}
              {navItem('Help & Support', 'help')}
            </ul>
          </nav>

          {/* About Us */}
          {activeSection === 'about' && (
  <section className="border border-gray rounded-2xl p-6">
    <h1 className="text-3xl font-bold mb-4 text-[#3674B5]">About Us</h1>
    <div className="flex flex-col md:flex-row space-y-6 md:space-y-0 md:space-x-6">
      <div className="flex-1">
        <p className="mb-4 text-[#2E2E2E] leading-relaxed">
          AdsToGo is an innovative mobile advertising platform that transforms vehicles into moving digital billboards.
          Our mission is to connect brands with audiences in fresh, interactive ways while creating income opportunities for drivers.
        </p>
        <p className="text-[#2E2E2E] leading-relaxed">
          By integrating LCD screens and QR code interactivity, we create a dynamic advertising ecosystem tailored for the Philippines' growing vehicle market.
        </p>
      </div>
      <div className="flex-1 shadow-lg rounded-2xl p-6">
        <form className="space-y-4">
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="email">
              Your Email Address
            </label>
            <input
              id="email"
              type="email"
              placeholder="Enter your email"
              className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none hover:scale-105 transition-all duration-300"
            />
          </div>
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="topic">
              Can't find what you are looking for? Tell us below:
            </label>
            <textarea
              id="topic"
              placeholder="Enter your concern"
              className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none resize-y hover:scale-105 transition-all duration-300"
              style={{ minHeight: '32px', maxHeight: '200px' }}
            />
          </div>
          <div className="flex justify-end">
  <button
    type="submit"
    className="w-44 bg-[#F3A26D] text-black p-2 rounded-lg hover:bg-[#578FCA] hover:scale-105 transition-all duration-300"
  >
    Send your request
  </button>
</div>
        </form>
      </div>
    </div>
  </section>
)}

          {/* Privacy Policy */}
          {activeSection === 'privacy' && (
            <section className="border border-gray rounded-2xl p-6">
              <h1 className="text-3xl font-bold mb-4 text-[#3674B5]">Privacy Policy</h1>
              <p className="mb-4 text-[#2E2E2E] leading-relaxed">
                We respect your privacy. AdsToGo collects only essential data required to track ad performance and driver earnings.
                Consumer interactions through QR codes are anonymized and used solely to improve advertising effectiveness.
              </p>
              <p className="text-[#2E2E2E] leading-relaxed">
                We do not share personal information with third parties except as required by law or with your explicit consent.
              </p>
            </section>
          )}

          {/* Terms and Conditions */}
          {activeSection === 'terms' && (
            <section className="border border-gray rounded-2xl p-6">
              <h1 className="text-3xl font-bold mb-4 text-[#3674B5]">Terms and Conditions</h1>
              <p className="mb-4 text-[#2E2E2E] leading-relaxed">
                By using AdsToGo services, you agree to comply with all applicable laws and regulations.
                Advertisers must provide appropriate content and respect copyright laws.
                Drivers agree to maintain their vehicles according to the platform standards and participate fairly in the revenue sharing model.
              </p>
              <p className="text-[#2E2E2E] leading-relaxed">
                AdsToGo reserves the right to modify these terms at any time with prior notice.
              </p>
            </section>
          )}

          {/* Help & Support */}
          {activeSection === 'help' && (
            <section className="border border-gray rounded-2xl p-6">
              <h1 className="text-3xl font-bold mb-4 text-[#3674B5]">Help & Support</h1>

              <section className="mb-6">
                <h2 className="text-2xl font-semibold mb-2 text-black">What is AdsToGo?</h2>
                <p className="text-[#2E2E2E] leading-relaxed">
                  AdsToGo is a mobile digital advertising platform that transforms everyday vehicles into moving ad spaces.
                  Through the use of LCD screens mounted on cars, we broadcast digital ads throughout urban and rural areas—
                  increasing brand visibility and community reach.
                </p>
              </section>

              <section className="mb-6">
                <h2 className="text-2xl font-semibold mb-2 text-black">How Does It Work?</h2>
                <ul className="list-disc list-inside space-y-1 text-[#2E2E2E] leading-relaxed">
                  <li>Advertisers upload and manage their digital ad content through the dashboard.</li>
                  <li>Vehicles equipped with LCD screens display the ads as they travel.</li>
                  <li>Real-time tracking tools monitor ad impressions and travel distance.</li>
                  <li>Consumers can interact with ads via QR codes displayed on-screen.</li>
                  <li>Drivers earn income based on how far they travel and how many impressions their vehicle generates.</li>
                </ul>
              </section>

              <section className="mb-6">
                <h2 className="text-2xl font-semibold mb-2 text-black">Benefits</h2>
                <ul className="list-disc list-inside space-y-1 text-[#2E2E2E] leading-relaxed">
                  <li><strong>For Advertisers:</strong> Broader reach, measurable results, and consumer engagement via QR codes.</li>
                  <li><strong>For Drivers:</strong> Passive income through fair, distance-based revenue sharing.</li>
                  <li><strong>For Consumers:</strong> Instant access to more information through QR code scanning.</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-2 text-black">Need More Help?</h2>
                <p className="text-[#2E2E2E] leading-relaxed">
                  For technical issues, ad guidelines, or driver onboarding support, please contact our team at{' '}
                  <a href="mailto:support@adstogo.ph" className="text-[#0A192F] underline font-semibold hover:text-[#2EC4B6]">
                    support@adstogo.ph
                  </a>.
                </p>
              </section>
            </section>
          )}
        </main>
      </div>
    </div>
  );
};

export default Help;