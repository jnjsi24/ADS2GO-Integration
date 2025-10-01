import React from 'react';

interface TermsOfServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TermsOfServiceModal: React.FC<TermsOfServiceModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 transition-opacity duration-300"
      onClick={onClose}
    >
      <div 
        className="relative bg-white rounded-lg p-8 w-[90vw] sm:w-[80vw] md:w-[70vw] lg:w-[60vw] xl:w-[50vw] max-h-[80vh] overflow-y-auto transition-all duration-300 transform"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="absolute top-4 right-4 text-gray-600 hover:text-gray-800 transition-colors duration-200 hover:scale-110 text-2xl"
          onClick={onClose}
        >
          ✕
        </button>
        
        <div className="space-y-6">
          <h2 className="text-3xl font-bold text-[#3674B5] mb-6">Terms of Service</h2>
          <p className="text-sm text-gray-500">Last updated: January 2025</p>
          
          <div className="space-y-6 text-sm text-gray-700">
            <section>
              <h3 className="text-lg font-semibold text-[#3674B5] mb-3">1. Acceptance of Terms</h3>
              <p className="mb-3">
                By accessing and using Ads2Go services, you accept and agree to be bound by the terms and provision of this agreement. 
                If you do not agree to abide by the above, please do not use this service.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-[#3674B5] mb-3">2. Description of Service</h3>
              <p className="mb-3">
                Ads2Go provides mobile advertising services through a network of vehicles equipped with digital displays and vinyl wraps. 
                Our platform connects advertisers with vehicle owners to display promotional content.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-[#3674B5] mb-3">3. User Accounts</h3>
              <p className="mb-3">
                To use our services, you must create an account. You are responsible for maintaining the confidentiality of your account 
                and password and for restricting access to your computer. You agree to accept responsibility for all activities that occur 
                under your account or password.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-[#3674B5] mb-3">4. Payment Terms</h3>
              <p className="mb-3">
                All fees are due in advance and are non-refundable unless otherwise specified. We reserve the right to change our fees 
                at any time with 30 days' notice. Payment methods include credit cards, bank transfers, and other approved methods.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-[#3674B5] mb-3">5. Content Guidelines</h3>
              <p className="mb-3">
                All advertising content must comply with local laws and regulations. Prohibited content includes but is not limited to:
              </p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>Illegal or harmful content</li>
                <li>Content that violates intellectual property rights</li>
                <li>Discriminatory or offensive material</li>
                <li>False or misleading advertisements</li>
                <li>Content targeting minors inappropriately</li>
              </ul>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-[#3674B5] mb-3">6. Performance and Analytics</h3>
              <p className="mb-3">
                We provide analytics and performance data based on our tracking systems. While we strive for accuracy, we cannot 
                guarantee 100% accuracy of impression counts or other metrics. Our analytics are provided "as is" for informational purposes.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-[#3674B5] mb-3">7. Limitation of Liability</h3>
              <p className="mb-3">
                Ads2Go shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including without 
                limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your use of the service.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-[#3674B5] mb-3">8. Termination</h3>
              <p className="mb-3">
                We may terminate or suspend your account immediately, without prior notice or liability, for any reason whatsoever, 
                including without limitation if you breach the Terms. Upon termination, your right to use the service will cease immediately.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-[#3674B5] mb-3">9. Governing Law</h3>
              <p className="mb-3">
                These Terms shall be interpreted and governed by the laws of the Philippines. Any disputes arising from these terms 
                shall be subject to the exclusive jurisdiction of the courts of the Philippines.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-[#3674B5] mb-3">10. Contact Information</h3>
              <p className="mb-3">
                If you have any questions about these Terms of Service, please contact us at:
              </p>
              <div className="bg-gray-50 p-4 rounded">
                <p>Email: legal@ads2go.com</p>
                <p>Phone: +63 2 1234 5678</p>
                <p>Address: Makati City, Metro Manila, Philippines 1200</p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsOfServiceModal;
