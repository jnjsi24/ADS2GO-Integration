import React, { useState } from "react";
// ✅ If you already use lucide-react or heroicons, adjust import accordingly.
// Here we use Heroicons outline set:
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/solid";

const FAQItem: React.FC<{ question: string; answer: string }> = ({
  question,
  answer,
}) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex justify-between items-center py-3 text-left font-medium text-[#2E2E2E]
                   hover:text-black transition"
      >
        {question}
        {/* ✅ Chevron Up/Down icon */}
        <span
          className={`transition-transform duration-300 ${
            open ? "rotate-180" : "rotate-0"
          }`}
        >
          {/* When rotated, ChevronDown will look like an Up arrow. */}
          <ChevronDownIcon className="w-5 h-5" />
        </span>
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ${
          open ? "faq-open" : "faq-closed"
        }`}
      >
        <p className="pb-4 text-[#2E2E2E]">{answer}</p>
      </div>
    </div>
  );
};

const Help: React.FC = () => {
  return (
    
    <div className="min-h-screen pl-72 pr-5 p-10 bg-gradient-to-b from-[#EEEEEE] to-[#F8FAFC]">
  {/* Header */}
      {/* ✅ Inline CSS for accordion animation */}
      <style>{`
        .faq-open { max-height: 500px; }
        .faq-closed { max-height: 0; }
      `}</style>

      <main className="mx-auto p-6 space-y-10 max-w-7xl" aria-live="polite">
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
                className="text-xs text-black rounded-lg pl-5 pr-20 py-3 w-full shadow-md focus:outline-none bg-white"
              />
              <button
                className="absolute right-1 top-1/2 -translate-y-1/2 bg-[#feb011] text-white text-sm rounded-lg px-4 py-1.5
                           hover:bg-[#FF9B45] hover:scale-105 transition-all duration-300"
              >
                Search
              </button>
            </div>
          </div>
        </div>

        {/* About Us */}
        <section className="rounded-2xl p-6">
          <h1 className="text-3xl font-bold mb-4 text-[#3674B5]">About Us</h1>
          <p className="mb-4 text-[#2E2E2E] leading-relaxed">
            AdsToGo is an innovative mobile advertising platform that transforms
            vehicles into moving digital billboards. Our mission is to connect
            brands with audiences in fresh, interactive ways while creating
            income opportunities for drivers.
          </p>
          <p className="text-[#2E2E2E] leading-relaxed">
            By integrating LCD screens and QR code interactivity, we create a
            dynamic advertising ecosystem tailored for the Philippines' growing
            vehicle market.
          </p>
        </section>

        {/* FAQ with chevron animation */}
        <section className="rounded-2xl p-6">
          <h1 className="text-3xl font-bold mb-6 text-[#3674B5]">
            Frequently Asked Questions (FAQ)
          </h1>

          <h2 className="text-2xl font-semibold mb-4 text-black">
            For Advertisers:
          </h2>
          <FAQItem
            question="What kind of ad content can I run on AdsToGo?"
            answer="We support a variety of digital formats, including static images, GIFs, and short video clips. All content is subject to our advertising guidelines to ensure it is appropriate for public display."
          />
          <FAQItem
            question="How exactly do you track impressions and ensure my ad is being seen?"
            answer="Our proprietary technology uses a combination of GPS data and advanced algorithms to count an impression. We provide detailed reports showing the times, routes, and estimated audience reach."
          />
          <FAQItem
            question="Can I choose where my ads are displayed?"
            answer="Yes, to an extent. While our network is mobile, our dashboard allows you to target ads by general geographic zones or cities."
          />
          <FAQItem
            question="What happens if the car is driving at night? Are my ads still effective?"
            answer="Absolutely. The LCD screens are designed for high brightness and clarity, ensuring your ads are visible day and night."
          />

          <h2 className="text-2xl font-semibold mt-10 mb-4 text-black">
            For Drivers:
          </h2>
          <FAQItem
            question="How do I qualify to become an AdsToGo driver?"
            answer="Requirements typically include being of legal age, having a valid driver's license and vehicle registration, driving a certain number of miles per week, and agreeing to our terms of service."
          />
          <FAQItem
            question="How and when do I get paid?"
            answer="Drivers earn revenue based on distance traveled and impressions generated. Payments are processed monthly via direct deposit once your earnings exceed a minimum threshold."
          />
          <FAQItem
            question="Will the screen damage my car?"
            answer="Not at all. Our screens are professionally installed using non-invasive mounting systems designed to protect your vehicle's exterior."
          />
          <FAQItem
            question="Does having the screen affect my driving or battery life?"
            answer="The system is passive for the driver and powered so it does not drain your car's battery."
          />

          <h2 className="text-2xl font-semibold mt-10 mb-4 text-black">
            For Everyone:
          </h2>
          <FAQItem
            question="Is this safe for drivers and pedestrians?"
            answer="Safety is our top priority. The content on our screens is strictly moderated to avoid any distracting or inappropriate material."
          />
          <FAQItem
            question="How do I scan the QR code safely?"
            answer="Only scan QR codes when you are not operating a vehicle. Use your smartphone's camera to safely access the advertised content."
          />
        </section>
      </main>
    </div>
  );
};

export default Help;
