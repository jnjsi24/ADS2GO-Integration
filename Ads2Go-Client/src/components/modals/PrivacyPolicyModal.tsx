import React from 'react';

interface PrivacyPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({ isOpen, onClose }) => {
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
          <h2 className="text-3xl font-bold text-[#3674B5] mb-6">Privacy Policy</h2>
          <p className="text-sm text-gray-500">Last updated: January 2025</p>
          
          <div className="space-y-6 text-sm text-gray-700">
            <section>
              <h3 className="text-lg font-semibold text-[#3674B5] mb-3">1. Information We Collect</h3>
              <p className="mb-3">
                We collect information you provide directly to us, such as when you create an account, use our services, 
                or contact us for support. This may include:
              </p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>Personal information (name, email, phone number)</li>
                <li>Business information (company name, industry, billing address)</li>
                <li>Payment information (processed securely through third-party providers)</li>
                <li>Advertising content and campaign details</li>
                <li>Communication records and support interactions</li>
              </ul>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-[#3674B5] mb-3">2. How We Use Your Information</h3>
              <p className="mb-3">We use the information we collect to:</p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>Provide, maintain, and improve our services</li>
                <li>Process transactions and send related information</li>
                <li>Send technical notices, updates, and support messages</li>
                <li>Respond to your comments and questions</li>
                <li>Monitor and analyze trends and usage</li>
                <li>Comply with legal obligations</li>
              </ul>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-[#3674B5] mb-3">3. Information Sharing and Disclosure</h3>
              <p className="mb-3">
                We do not sell, trade, or otherwise transfer your personal information to third parties without your consent, 
                except in the following circumstances:
              </p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>With your explicit consent</li>
                <li>To comply with legal obligations</li>
                <li>To protect our rights and prevent fraud</li>
                <li>With service providers who assist in our operations</li>
                <li>In connection with a business transfer or acquisition</li>
              </ul>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-[#3674B5] mb-3">4. Data Security</h3>
              <p className="mb-3">
                We implement appropriate technical and organizational security measures to protect your personal information 
                against unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over 
                the internet or electronic storage is 100% secure.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-[#3674B5] mb-3">5. Cookies and Tracking Technologies</h3>
              <p className="mb-3">
                We use cookies and similar tracking technologies to enhance your experience on our platform. You can control 
                cookie settings through your browser preferences, though some features may not function properly if cookies are disabled.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-[#3674B5] mb-3">6. Your Rights and Choices</h3>
              <p className="mb-3">You have the right to:</p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>Access and update your personal information</li>
                <li>Request deletion of your personal information</li>
                <li>Opt-out of marketing communications</li>
                <li>Request data portability</li>
                <li>Withdraw consent where applicable</li>
              </ul>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-[#3674B5] mb-3">7. Data Retention</h3>
              <p className="mb-3">
                We retain your personal information for as long as necessary to provide our services and fulfill the purposes 
                outlined in this privacy policy, unless a longer retention period is required or permitted by law.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-[#3674B5] mb-3">8. International Data Transfers</h3>
              <p className="mb-3">
                Your information may be transferred to and processed in countries other than your country of residence. 
                We ensure appropriate safeguards are in place to protect your personal information in accordance with this privacy policy.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-[#3674B5] mb-3">9. Children's Privacy</h3>
              <p className="mb-3">
                Our services are not intended for children under 13 years of age. We do not knowingly collect personal 
                information from children under 13. If we become aware that we have collected personal information from a child under 13, 
                we will take steps to delete such information.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-[#3674B5] mb-3">10. Changes to This Privacy Policy</h3>
              <p className="mb-3">
                We may update this privacy policy from time to time. We will notify you of any changes by posting the new 
                privacy policy on this page and updating the "Last updated" date. Your continued use of our services after 
                any changes constitutes acceptance of the updated privacy policy.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-[#3674B5] mb-3">11. Contact Us</h3>
              <p className="mb-3">
                If you have any questions about this privacy policy or our data practices, please contact us at:
              </p>
              <div className="bg-gray-50 p-4 rounded">
                <p>Email: privacy@ads2go.com</p>
                <p>Phone: +63 2 1234 5678</p>
                <p>Address: Makati City, Metro Manila, Philippines 1200</p>
                <p>Data Protection Officer: dpo@ads2go.com</p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicyModal;
