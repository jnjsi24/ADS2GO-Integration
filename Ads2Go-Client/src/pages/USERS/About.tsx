import React from 'react';
import { Info, Target, Users, Lightbulb, MapPin } from 'lucide-react';

const About: React.FC = () => {
  return (
    <div className="min-h-screen bg-white pl-64 pr-5">
      <main className="mx-auto p-6 space-y-10 max-w-7xl" aria-live="polite">
        {/* Header Section */}
        <section className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-6">
            <Info className="w-12 h-12 text-[#3674B5]" />
            <h1 className="text-5xl font-bold text-[#3674B5]">About Us</h1>
          </div>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            Transforming the way brands connect with audiences through innovative mobile advertising solutions
          </p>
        </section>

        {/* Mission Section */}
        <section className="rounded-2xl p-8 bg-gradient-to-r from-[#3674B5] to-[#578FCA] text-white">
          <div className="flex items-start gap-4 mb-6">
            <Target className="w-8 h-8 text-white flex-shrink-0 mt-1" />
            <div>
              <h2 className="text-3xl font-bold mb-4">Our Mission</h2>
              <p className="text-lg leading-relaxed text-blue-100">
                AdsToGo is an innovative mobile advertising platform that transforms vehicles into moving digital billboards. 
                Our mission is to connect brands with audiences in fresh, interactive ways while creating income opportunities for drivers.
              </p>
            </div>
          </div>
        </section>

        {/* Vision Section */}
        <section className="rounded-2xl p-8 bg-white border-2 border-[#3674B5]">
          <div className="flex items-start gap-4 mb-6">
            <Lightbulb className="w-8 h-8 text-[#3674B5] flex-shrink-0 mt-1" />
            <div>
              <h2 className="text-3xl font-bold mb-4 text-[#3674B5]">Our Vision</h2>
              <p className="text-lg leading-relaxed text-gray-700">
                By integrating LCD screens and QR code interactivity, we create a dynamic advertising ecosystem 
                tailored for the Philippines' growing vehicle market. We envision a future where every journey 
                becomes an opportunity for meaningful brand engagement.
              </p>
            </div>
          </div>
        </section>

        {/* What We Do Section */}
        <section className="rounded-2xl p-8 bg-gray-50">
          <h2 className="text-3xl font-bold mb-8 text-[#3674B5] text-center">What We Do</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-[#3674B5] rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-gray-800">Connect Brands & Audiences</h3>
              <p className="text-gray-600 leading-relaxed">
                We bridge the gap between advertisers and their target market through innovative mobile advertising solutions.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-[#3674B5] rounded-full flex items-center justify-center mx-auto mb-4">
                <MapPin className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-gray-800">Mobile Billboards</h3>
              <p className="text-gray-600 leading-relaxed">
                Transform vehicles into dynamic digital billboards that reach audiences wherever they go.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-[#3674B5] rounded-full flex items-center justify-center mx-auto mb-4">
                <Target className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-gray-800">Income Opportunities</h3>
              <p className="text-gray-600 leading-relaxed">
                Create sustainable income streams for drivers while providing effective advertising solutions for brands.
              </p>
            </div>
          </div>
        </section>

        {/* Technology Section */}
        <section className="rounded-2xl p-8 bg-white border-2 border-gray-200">
          <h2 className="text-3xl font-bold mb-6 text-[#3674B5] text-center">Our Technology</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-xl font-semibold mb-4 text-gray-800">LCD Screen Integration</h3>
              <p className="text-gray-600 leading-relaxed mb-4">
                High-quality LCD screens mounted on vehicles provide crisp, clear advertising displays that capture attention 
                and deliver your message effectively to passing audiences.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-4 text-gray-800">QR Code Interactivity</h3>
              <p className="text-gray-600 leading-relaxed mb-4">
                Interactive QR codes enable real-time engagement, allowing audiences to instantly connect with your brand 
                and access additional information or promotions.
              </p>
            </div>
          </div>
        </section>

        {/* Market Focus Section */}
        <section className="rounded-2xl p-8 bg-gradient-to-r from-[#578FCA] to-[#3674B5] text-white">
          <h2 className="text-3xl font-bold mb-6 text-center">Focused on the Philippines</h2>
          <p className="text-lg leading-relaxed text-center text-blue-100 max-w-4xl mx-auto">
            We understand the unique characteristics of the Philippine market and have designed our platform 
            specifically to meet the needs of local businesses and drivers. Our solutions are tailored to 
            maximize impact in the dynamic and growing vehicle market of the Philippines.
          </p>
        </section>

        {/* Call to Action */}
        <section className="text-center py-12">
          <h2 className="text-3xl font-bold mb-4 text-[#3674B5]">Ready to Get Started?</h2>
          <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
            Join the future of mobile advertising. Start reaching new audiences with our innovative 
            mobile advertising platform designed for the Philippines market.
          </p>
          <div className="flex justify-center">
            <button className="px-8 py-3 bg-[#3674B5] text-white rounded-lg font-semibold hover:bg-[#578FCA] transition-colors">
              Start Advertising
            </button>
          </div>
        </section>
      </main>
    </div>
  );
};

export default About;
