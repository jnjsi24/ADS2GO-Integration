import React from 'react';
import { 
  Info, 
  Target, 
  Users, 
  Lightbulb, 
  MapPin, 
  Award, 
  TrendingUp, 
  Shield, 
  Globe, 
  Heart,
  CheckCircle,
  ArrowRight,
  Star,
  BarChart3,
  Zap,
  Clock
} from 'lucide-react';

const About: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 pl-64 pr-5">
      <main className="mx-auto p-6 space-y-16 max-w-7xl" aria-live="polite">
        {/* Hero Section */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#3674B5] via-[#4A90E2] to-[#578FCA] text-white">
          <div className="absolute inset-0 bg-black/10"></div>
          <div className="relative px-8 py-20">
            <div className="max-w-5xl mx-auto text-center">
              <div className="flex items-center justify-center gap-4 mb-8">
                <div className="p-4 bg-white/20 rounded-3xl backdrop-blur-sm">
                  <Info className="w-16 h-16 text-white" />
                </div>
                <h1 className="text-6xl font-bold">About Ads2Go</h1>
              </div>
              <p className="text-2xl text-blue-100 mb-8 max-w-4xl mx-auto leading-relaxed">
                Revolutionizing mobile advertising in the Philippines through innovative technology and sustainable business models
              </p>
              <div className="flex flex-wrap justify-center gap-6 text-lg">
                <div className="flex items-center gap-2 bg-white/20 px-4 py-2 rounded-full backdrop-blur-sm">
                  <Award className="w-5 h-5" />
                  <span>Industry Leader</span>
                </div>
                <div className="flex items-center gap-2 bg-white/20 px-4 py-2 rounded-full backdrop-blur-sm">
                  <Globe className="w-5 h-5" />
                  <span>Philippines Focus</span>
                </div>
                <div className="flex items-center gap-2 bg-white/20 px-4 py-2 rounded-full backdrop-blur-sm">
                  <TrendingUp className="w-5 h-5" />
                  <span>Growing Platform</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Mission & Vision Section */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Mission */}
          <div className="bg-white rounded-3xl p-10 shadow-xl border border-gray-100">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-blue-100 rounded-2xl">
                <Target className="w-8 h-8 text-[#3674B5]" />
              </div>
              <h2 className="text-3xl font-bold text-gray-800">Our Mission</h2>
            </div>
            <p className="text-lg leading-relaxed text-gray-700 mb-6">
              Ads2Go is an innovative mobile advertising platform that transforms vehicles into moving digital billboards. 
              Our mission is to connect brands with audiences in fresh, interactive ways while creating sustainable income opportunities for drivers.
            </p>
            <div className="flex items-center text-[#3674B5] font-semibold">
              <ArrowRight className="w-5 h-5 mr-2" />
              Learn more about our impact
            </div>
          </div>

          {/* Vision */}
          <div className="bg-gradient-to-br from-[#3674B5] to-[#578FCA] rounded-3xl p-10 text-white shadow-xl">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                <Lightbulb className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-3xl font-bold">Our Vision</h2>
            </div>
            <p className="text-lg leading-relaxed text-blue-100 mb-6">
              By integrating LCD screens and QR code interactivity, we create a dynamic advertising ecosystem 
              tailored for the Philippines' growing vehicle market. We envision a future where every journey 
              becomes an opportunity for meaningful brand engagement.
            </p>
            <div className="flex items-center text-white/90 font-semibold">
              <ArrowRight className="w-5 h-5 mr-2" />
              Discover our roadmap
            </div>
          </div>
        </section>

        {/* What We Do Section */}
        <section className="bg-white rounded-3xl p-12 shadow-xl">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-800 mb-4">What We Do</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              We create innovative solutions that benefit everyone in the advertising ecosystem
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="group p-8 rounded-2xl border border-gray-200 hover:border-[#3674B5] hover:shadow-lg transition-all duration-300">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                <Users className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold mb-4 text-gray-800 text-center">Connect Brands & Audiences</h3>
              <p className="text-gray-600 leading-relaxed text-center mb-4">
                We bridge the gap between advertisers and their target market through innovative mobile advertising solutions.
              </p>
              <div className="flex items-center justify-center text-[#3674B5] font-semibold text-sm">
                Learn more <ArrowRight className="w-4 h-4 ml-1" />
              </div>
            </div>

            <div className="group p-8 rounded-2xl border border-gray-200 hover:border-[#3674B5] hover:shadow-lg transition-all duration-300">
              <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                <MapPin className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold mb-4 text-gray-800 text-center">Mobile Billboards</h3>
              <p className="text-gray-600 leading-relaxed text-center mb-4">
                Transform vehicles into dynamic digital billboards that reach audiences wherever they go.
              </p>
              <div className="flex items-center justify-center text-[#3674B5] font-semibold text-sm">
                Learn more <ArrowRight className="w-4 h-4 ml-1" />
              </div>
            </div>

            <div className="group p-8 rounded-2xl border border-gray-200 hover:border-[#3674B5] hover:shadow-lg transition-all duration-300">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                <Target className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold mb-4 text-gray-800 text-center">Income Opportunities</h3>
              <p className="text-gray-600 leading-relaxed text-center mb-4">
                Create sustainable income streams for drivers while providing effective advertising solutions for brands.
              </p>
              <div className="flex items-center justify-center text-[#3674B5] font-semibold text-sm">
                Learn more <ArrowRight className="w-4 h-4 ml-1" />
              </div>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="bg-gradient-to-r from-[#3674B5] to-[#578FCA] rounded-3xl p-12 text-white">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">Our Impact</h2>
            <p className="text-xl text-blue-100 max-w-3xl mx-auto">
              Numbers that speak to our success and growth in the mobile advertising space
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold mb-2">500+</div>
              <div className="text-blue-100">Active Drivers</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold mb-2">1000+</div>
              <div className="text-blue-100">Successful Campaigns</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold mb-2">50K+</div>
              <div className="text-blue-100">Daily Impressions</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold mb-2">95%</div>
              <div className="text-blue-100">Client Satisfaction</div>
            </div>
          </div>
        </section>

        {/* Technology Section */}
        <section className="bg-white rounded-3xl p-12 shadow-xl">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-800 mb-4">Our Technology</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Cutting-edge technology that powers our mobile advertising platform
            </p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div className="space-y-8">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-blue-100 rounded-2xl flex-shrink-0">
                  <BarChart3 className="w-8 h-8 text-[#3674B5]" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold mb-4 text-gray-800">LCD Screen Integration</h3>
                  <p className="text-gray-600 leading-relaxed mb-4">
                    High-quality LCD screens mounted on vehicles provide crisp, clear advertising displays that capture attention 
                    and deliver your message effectively to passing audiences.
                  </p>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span>4K resolution displays</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span>Weather-resistant design</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span>Real-time content updates</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="space-y-8">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-green-100 rounded-2xl flex-shrink-0">
                  <Zap className="w-8 h-8 text-green-600" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold mb-4 text-gray-800">QR Code Interactivity</h3>
                  <p className="text-gray-600 leading-relaxed mb-4">
                    Interactive QR codes enable real-time engagement, allowing audiences to instantly connect with your brand 
                    and access additional information or promotions.
                  </p>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span>Instant engagement tracking</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span>Mobile-optimized landing pages</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span>Analytics and insights</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Values Section */}
        <section className="bg-gradient-to-br from-gray-50 to-blue-50 rounded-3xl p-12">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-800 mb-4">Our Values</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              The principles that guide everything we do
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Heart className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-gray-800">Innovation</h3>
              <p className="text-gray-600">We constantly push boundaries to create better advertising solutions</p>
            </div>

            <div className="text-center p-6">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-gray-800">Trust</h3>
              <p className="text-gray-600">We build lasting relationships through transparency and reliability</p>
            </div>

            <div className="text-center p-6">
              <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Globe className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-gray-800">Impact</h3>
              <p className="text-gray-600">We measure success by the positive impact we create for all stakeholders</p>
            </div>
          </div>
        </section>

        {/* Market Focus Section */}
        <section className="bg-gradient-to-r from-[#3674B5] to-[#578FCA] rounded-3xl p-12 text-white">
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                <Globe className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-4xl font-bold">Focused on the Philippines</h2>
            </div>
            <p className="text-xl leading-relaxed text-blue-100 max-w-4xl mx-auto">
              We understand the unique characteristics of the Philippine market and have designed our platform 
              specifically to meet the needs of local businesses and drivers. Our solutions are tailored to 
              maximize impact in the dynamic and growing vehicle market of the Philippines.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center p-6 bg-white/10 rounded-2xl backdrop-blur-sm">
              <div className="text-3xl font-bold mb-2">110M+</div>
              <div className="text-blue-100">Population</div>
            </div>
            <div className="text-center p-6 bg-white/10 rounded-2xl backdrop-blur-sm">
              <div className="text-3xl font-bold mb-2">15M+</div>
              <div className="text-blue-100">Registered Vehicles</div>
            </div>
            <div className="text-center p-6 bg-white/10 rounded-2xl backdrop-blur-sm">
              <div className="text-3xl font-bold mb-2">85%</div>
              <div className="text-blue-100">Mobile Penetration</div>
            </div>
          </div>
        </section>

        {/* Team Section */}
        <section className="bg-white rounded-3xl p-12 shadow-xl">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-800 mb-4">Our Team</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Passionate professionals dedicated to revolutionizing mobile advertising
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="text-center p-6">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-xl font-bold mb-2 text-gray-800">Technology Team</h3>
              <p className="text-gray-600">Innovative developers and engineers building the future</p>
            </div>

            <div className="text-center p-6">
              <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-xl font-bold mb-2 text-gray-800">Business Team</h3>
              <p className="text-gray-600">Strategic minds driving growth and partnerships</p>
            </div>

            <div className="text-center p-6">
              <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Heart className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-xl font-bold mb-2 text-gray-800">Support Team</h3>
              <p className="text-gray-600">Dedicated professionals ensuring your success</p>
            </div>
          </div>
        </section>

        {/* Call to Action */}
        <section className="bg-gradient-to-r from-[#3674B5] to-[#578FCA] rounded-3xl p-12 text-white text-center">
          <h2 className="text-4xl font-bold mb-6">Ready to Get Started?</h2>
          <p className="text-xl text-blue-100 mb-8 max-w-3xl mx-auto">
            Join the future of mobile advertising. Start reaching new audiences with our innovative 
            mobile advertising platform designed for the Philippines market.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <button className="px-8 py-4 bg-white text-[#3674B5] rounded-2xl font-semibold hover:bg-blue-50 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1">
              Start Advertising
            </button>
            <button className="px-8 py-4 bg-white/20 text-white rounded-2xl font-semibold hover:bg-white/30 transition-all backdrop-blur-sm">
              Learn More
            </button>
          </div>
        </section>
      </main>
    </div>
  );
};

export default About;
