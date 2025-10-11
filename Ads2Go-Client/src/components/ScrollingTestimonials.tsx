import React from 'react';
import { motion } from 'framer-motion';

interface Testimonial {
  name: string;
  role: string;
  quote: string;
  image: string;
}

const testimonials: Testimonial[] = [
  {
    name: 'Sarah Chen',
    role: 'Marketing Director @ TechFlow',
    quote: 'Our brand visibility increased by 300% in just 2 months. The targeted vehicle routes reached our exact demographic.',
    image: '/images/testimonial-sarah-chen.jpg',
  },
  {
    name: 'Miguel Rodriguez',
    role: 'CEO @ UrbanEats',
    quote: 'The ROI exceeded our expectations. We saw a 45% boost in store visits from areas we never reached before.',
    image: '/images/testimonial-miguel-rodriguez.jpg',
  },
  {
    name: 'Jessica Williams',
    role: 'Founder @ BloomBox',
    quote: 'Finally, an advertising platform that understands local businesses. The dashboard made tracking so simple.',
    image: '/images/testimonial-jessica-williams.jpg',
  },
  {
    name: 'David Kim',
    role: 'Marketing Manager @ FitLife',
    quote: 'The real-time analytics helped us optimize our campaign on the fly. Customer engagement went through the roof!',
    image: '/images/testimonial-david-kim.jpg',
  },
  {
    name: 'Amanda Thompson',
    role: 'Owner @ CafeNook',
    quote: 'As a small business, every peso counts. This gave us the reach of big brands at a fraction of the cost.',
    image: '/images/testimonial-amanda-thompson.jpg',
  },
  {
    name: 'James Wilson',
    role: 'CEO @ AutoCare Plus',
    quote: 'The motorcycle ads in traffic hotspots brought us customers we never would have reached through traditional media.',
    image: '/images/testimonial-james-wilson.jpg',
  },
  {
    name: 'Lisa Garcia',
    role: 'Marketing Head @ EduTech PH',
    quote: 'Seeing our ads on jeepneys and buses created incredible brand recall. Parents and students kept mentioning it.',
    image: '/images/testimonial-lisa-garcia.jpg',
  },
  {
    name: 'Robert Tan',
    role: 'Founder @ PinoyMart',
    quote: 'The ability to choose specific vehicle types let us target different neighborhoods with tailored messages.',
    image: '/images/testimonial-robert-tan.jpg',
  },
  {
    name: 'Maria Santos',
    role: 'Director @ GreenLife PH',
    quote: 'Our environmental message reached thousands daily. The platform made social impact advertising accessible.',
    image: '/images/testimonial-maria-santos.jpg',
  },
  {
    name: 'Carlos Reyes',
    role: 'Owner @ MobileTech Repair',
    quote: 'The LCD screens on vehicles caught attention even in heavy traffic. Our phone repair services saw a 60% increase.',
    image: '/images/testimonial-carlos-reyes.jpg',
  },
  {
    name: 'Emily Wong',
    role: 'Marketing Manager @ BeautyBox',
    quote: 'Perfect for reaching working professionals. The bus routes through business districts were incredibly effective.',
    image: '/images/testimonial-emily-wong.jpg',
  },
  {
    name: 'Daniel Martinez',
    role: 'CEO @ FoodExpress',
    quote: 'The campaign performance reports were detailed and actionable. We could see exactly which routes performed best.',
    image: '/images/testimonial-daniel-martinez.jpg',
  },
  {
    name: 'Sophie Davis',
    role: 'Founder @ KidCare',
    quote: 'Targeting school zones with our childcare services was a game-changer. The timing and placement were perfect.',
    image: '/images/testimonial-sophie-davis.jpg',
  },
  {
    name: 'Michael Brown',
    role: 'Marketing Director @ HomePlus',
    quote: 'The vinyl wraps on vehicles created moving billboards that reached every corner of the city. Incredible exposure.',
    image: '/images/testimonial-michael-brown.jpg',
  },
  {
    name: 'Anna Lopez',
    role: 'Owner @ FashionHub',
    quote: 'Our weekend sales increased by 85% after running ads on vehicles near malls and shopping districts.',
    image: '/images/testimonial-anna-lopez.jpg',
  },
  {
    name: 'Thomas Lee',
    role: 'CEO @ TechGadgets',
    quote: 'The real-time tracking feature let us see our ads moving around the city. It was both exciting and effective.',
    image: '/images/testimonial-thomas-lee.jpg',
  },
  {
    name: 'Rachel Green',
    role: 'Marketing Head @ HealthFirst',
    quote: 'Reaching commuters during their daily travel was brilliant. Our clinic appointments increased by 120%.',
    image: '/images/testimonial-rachel-green.jpg',
  },
  {
    name: 'Kevin Adams',
    role: 'Founder @ QuickClean',
    quote: 'The platform was so easy to use. Set up our first campaign in under 10 minutes and saw immediate results.',
    image: '/images/testimonial-kevin-adams.jpg',
  },
  {
    name: 'Olivia Parker',
    role: 'Director @ EduCare Center',
    quote: 'Perfect for educational institutions. Parents saw our ads while taking their kids to school - perfect timing!',
    image: '/images/testimonial-olivia-parker.jpg',
  },
  {
    name: 'Brian Scott',
    role: 'Owner @ AutoWorks',
    quote: 'The motorcycle ads brought us local customers, while bus routes expanded our reach to neighboring cities.',
    image: '/images/testimonial-brian-scott.jpg',
  },
  {
    name: 'Nina Rivera',
    role: 'Marketing Manager @ FitZone',
    quote: 'Our gym membership sign-ups tripled after running targeted ads in residential areas during commute hours.',
    image: '/images/testimonial-nina-rivera.jpg',
  },
];

const ScrollingTestimonials: React.FC = () => {
  // Split testimonials into three roughly equal rows
  const testimonialsPerRow = Math.ceil(testimonials.length / 3);
  const row1 = testimonials.slice(0, testimonialsPerRow);
  const row2 = testimonials.slice(testimonialsPerRow, testimonialsPerRow * 2);
  const row3 = testimonials.slice(testimonialsPerRow * 2);

  // Calculate total width for each row (approximate)
  const cardWidth = 320; // w-80 = 320px
  const gap = 8; // mx-2 = 8px (reduced from 16px)
  const totalWidth = (cardWidth + gap * 2) * row1.length;

  return (
    <section className="py-16 px-4 relative overflow-hidden bg-gradient-to-br from-[#1B5087] to-[#3674B5]">
      {/* Soft overlay for depth */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm z-0"></div>
      <div className="container mx-auto text-center relative z-10">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
          Trusted by Businesses Across the Philippines
        </h2>
        <p className="text-lg text-gray-200 mb-12 max-w-2xl mx-auto">
          See how companies of all sizes are driving growth with our innovative mobile advertising platform.
        </p>
        {/* Three Rows of Scrolling Testimonials */}
        <div className="space-y-8">
          {/* Row Template */}
          {[
            { data: row1, direction: "left", gradient: "from-blue-500 to-purple-600" },
            { data: row2, direction: "right", gradient: "from-green-500 to-blue-600" },
          ].map((row, i) => (
            <div key={i} className="overflow-hidden whitespace-nowrap relative">
              {/* Left and Right Edge Shadows */}
              <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-black/20 to-transparent z-10 pointer-events-none"></div>
              <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-black/20 to-transparent z-10 pointer-events-none"></div>
              <motion.div
                className="inline-flex"
                animate={{
                  x:
                    row.direction === "left"
                      ? [0, -totalWidth]
                      : [-totalWidth, 0],
                }}
                transition={{
                  x: {
                    repeat: Infinity,
                    repeatType: "loop",
                    duration: 40,
                    ease: "linear",
                  },
                }}
              >
                {[...row.data, ...row.data].map((testimonial, idx) => (
                  <div
                    key={`row-${i}-${idx}`}
                    className="inline-flex mx-1 w-80 backdrop-blur-md bg-white/10 border border-white/20 shadow-lg hover:shadow-2xl transition-all duration-300 flex-shrink-0"
                  >
                    <div className="p-6 w-full">
                      <div className="flex items-start mb-4">
                        <div className="flex-shrink-0">
                          <div
                            className={`w-12 h-12 bg-gradient-to-br ${row.gradient} rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md`}
                          >
                            {testimonial.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")}
                          </div>
                        </div>
                        <div className="ml-4 flex-1 min-w-0">
                          <h3 className="font-semibold text-white text-sm leading-tight">
                            {testimonial.name}
                          </h3>
                          <p className="text-xs text-gray-300 mt-1 leading-tight">
                            {testimonial.role}
                          </p>
                        </div>
                      </div>
                      <p className="text-gray-100 text-sm leading-relaxed line-clamp-4 italic">
                        “{testimonial.quote}”
                      </p>
                    </div>
                  </div>
                ))}
              </motion.div>
            </div>
          ))}
        </div>
      </div>
      {/* Subtle glow at bottom */}
      <div className="absolute bottom-0 left-0 w-full h-20 bg-gradient-to-t from-black/20 to-transparent"></div>
    </section>
  );
};

export default ScrollingTestimonials;