import React from 'react';

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const LegalModal: React.FC<LegalModalProps> = ({ isOpen, onClose }) => {
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
          <h2 className="text-3xl font-bold text-[#3674B5] mb-6">Legal Information</h2>
          
          <div className="space-y-6 text-sm text-gray-700">
            <section>
              <h3 className="text-lg font-semibold text-[#3674B5] mb-3">Company Information</h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="mb-2"><strong>Company Name:</strong> Ads2Go Philippines Inc.</p>
                <p className="mb-2"><strong>Registration Number:</strong> CS2024001234</p>
                <p className="mb-2"><strong>Business Address:</strong> Makati City, Metro Manila, Philippines 1200</p>
                <p className="mb-2"><strong>Tax Identification Number:</strong> 123-456-789-000</p>
                <p className="mb-2"><strong>SEC Registration:</strong> SEC-2024-001234</p>
              </div>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-[#3674B5] mb-3">Licenses and Permits</h3>
              <div className="space-y-2">
                <p>• Business Permit: Makati City Business Permit 2024-001234</p>
                <p>• Advertising License: DTI Advertising License AD-2024-001</p>
                <p>• Data Privacy Registration: NPC Registration NPC-2024-001234</p>
                <p>• Transport Permit: LTFRB Transport Permit TP-2024-001234</p>
              </div>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-[#3674B5] mb-3">Intellectual Property</h3>
              <p className="mb-3">
                All content, trademarks, logos, and intellectual property displayed on this platform are the property of 
                Ads2Go Philippines Inc. or its licensors. Unauthorized use, reproduction, or distribution is strictly prohibited.
              </p>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="font-semibold mb-2">Trademark Information:</p>
                <p>• "Ads2Go" - Registered Trademark (TM-2024-001234)</p>
                <p>• Logo and Brand Identity - Copyright © 2024</p>
                <p>• Mobile Advertising Platform - Patent Pending (PP-2024-001234)</p>
              </div>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-[#3674B5] mb-3">Compliance and Regulations</h3>
              <div className="space-y-3">
                <div>
                  <p className="font-semibold mb-1">Data Privacy Act Compliance</p>
                  <p className="text-sm text-gray-600">
                    We comply with the Philippine Data Privacy Act of 2012 (RA 10173) and maintain appropriate 
                    data protection measures for all personal information we collect and process.
                  </p>
                </div>
                <div>
                  <p className="font-semibold mb-1">Advertising Standards</p>
                  <p className="text-sm text-gray-600">
                    All advertising content must comply with the Advertising Standards Council of the Philippines (ASCP) 
                    guidelines and local advertising regulations.
                  </p>
                </div>
                <div>
                  <p className="font-semibold mb-1">Transport Regulations</p>
                  <p className="text-sm text-gray-600">
                    Our vehicle advertising operations comply with Land Transportation Franchising and Regulatory Board (LTFRB) 
                    regulations and local transport ordinances.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-[#3674B5] mb-3">Dispute Resolution</h3>
              <p className="mb-3">
                Any disputes arising from the use of our services shall be resolved through the following process:
              </p>
              <ol className="list-decimal list-inside space-y-1 ml-4">
                <li>Initial consultation and negotiation</li>
                <li>Mediation through the Philippine Mediation Center</li>
                <li>Arbitration under the Philippine Dispute Resolution Center rules</li>
                <li>Court proceedings in the appropriate Philippine courts as a last resort</li>
              </ol>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-[#3674B5] mb-3">Limitation of Liability</h3>
              <p className="mb-3">
                To the maximum extent permitted by law, Ads2Go Philippines Inc. shall not be liable for any indirect, 
                incidental, special, consequential, or punitive damages arising from the use of our services.
              </p>
              <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                <p className="text-sm text-yellow-800">
                  <strong>Important:</strong> Our liability is limited to the amount paid for the specific service 
                  that gave rise to the claim, and in no event shall our total liability exceed ₱100,000.
                </p>
              </div>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-[#3674B5] mb-3">Governing Law</h3>
              <p className="mb-3">
                These terms and any disputes arising from them shall be governed by and construed in accordance with 
                the laws of the Republic of the Philippines, without regard to conflict of law principles.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-[#3674B5] mb-3">Contact Information</h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="mb-2"><strong>Legal Department:</strong></p>
                <p className="mb-1">Email: legal@ads2go.com</p>
                <p className="mb-1">Phone: +63 2 1234 5678</p>
                <p className="mb-1">Address: Makati City, Metro Manila, Philippines 1200</p>
                <p className="mb-1">Office Hours: Monday - Friday, 9:00 AM - 6:00 PM</p>
              </div>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-[#3674B5] mb-3">Document Updates</h3>
              <p className="text-sm text-gray-500">
                This legal information was last updated on January 2025. We reserve the right to update this information 
                at any time. Users will be notified of significant changes through our platform or email notifications.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LegalModal;
