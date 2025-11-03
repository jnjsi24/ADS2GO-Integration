import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface TermsAndConditionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TermsAndConditionsModal: React.FC<TermsAndConditionsModalProps> = ({ isOpen, onClose }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 z-50"
            onClick={onClose}
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", duration: 0.5 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900">Terms and Conditions</h2>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <XMarkIcon className="h-6 w-6 text-gray-500" />
                </button>
              </div>
              
              {/* Content */}
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                <div className="prose prose-sm max-w-none">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">1. Acceptance of Terms</h3>
                  <p className="text-gray-700 mb-4">
                    By accessing and using Ads2Go services, you accept and agree to be bound by the terms and provision of this agreement.
                  </p>
                  
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">2. Use License</h3>
                  <p className="text-gray-700 mb-4">
                    Permission is granted to temporarily download one copy of the materials on Ads2Go's website for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and under this license you may not:
                  </p>
                  <ul className="list-disc list-inside text-gray-700 mb-4 space-y-2">
                    <li>modify or copy the materials</li>
                    <li>use the materials for any commercial purpose or for any public display</li>
                    <li>attempt to reverse engineer any software contained on the website</li>
                    <li>remove any copyright or other proprietary notations from the materials</li>
                  </ul>
                  
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">3. Service Description</h3>
                  <p className="text-gray-700 mb-4">
                    Ads2Go provides digital advertising services including but not limited to:
                  </p>
                  <ul className="list-disc list-inside text-gray-700 mb-4 space-y-2">
                    <li>Digital billboard advertising</li>
                    <li>Location-based advertising services</li>
                    <li>Analytics and reporting tools</li>
                    <li>Ad campaign management</li>
                  </ul>
                  
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">4. User Responsibilities</h3>
                  <p className="text-gray-700 mb-4">
                    As a user of Ads2Go services, you agree to:
                  </p>
                  <ul className="list-disc list-inside text-gray-700 mb-4 space-y-2">
                    <li>Provide accurate and complete information</li>
                    <li>Maintain the security of your account credentials</li>
                    <li>Use the service in compliance with all applicable laws</li>
                    <li>Not engage in any fraudulent or illegal activities</li>
                  </ul>
                  
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">5. Payment Terms</h3>
                  <p className="text-gray-700 mb-4">
                    Payment for services must be made in advance. All fees are non-refundable unless otherwise specified. We reserve the right to change our pricing at any time with 30 days notice.
                  </p>
                  
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">6. Privacy Policy</h3>
                  <p className="text-gray-700 mb-4">
                    Your privacy is important to us. Please review our Privacy Policy, which also governs your use of the service, to understand our practices.
                  </p>
                  
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">7. Limitation of Liability</h3>
                  <p className="text-gray-700 mb-4">
                    In no event shall Ads2Go, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential, or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your use of the service.
                  </p>
                  
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">8. Termination</h3>
                  <p className="text-gray-700 mb-4">
                    We may terminate or suspend your account and bar access to the service immediately, without prior notice or liability, under our sole discretion, for any reason whatsoever and without limitation, including but not limited to a breach of the Terms.
                  </p>
                  
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">9. Changes to Terms</h3>
                  <p className="text-gray-700 mb-4">
                    We reserve the right, at our sole discretion, to modify or replace these Terms at any time. If a revision is material, we will provide at least 30 days notice prior to any new terms taking effect.
                  </p>
                  
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">10. Contact Information</h3>
                  <p className="text-gray-700 mb-4">
                    If you have any questions about these Terms and Conditions, please contact us at:
                  </p>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-gray-700">
                      <strong>Email:</strong> support@ads2go.com<br />
                      <strong>Phone:</strong> +63 (2) 1234-5678<br />
                      <strong>Address:</strong> 123 Business District, Makati City, Philippines
                    </p>
                  </div>
                  
                  <p className="text-sm text-gray-500 mt-6">
                    Last updated: {new Date().toLocaleDateString()}
                  </p>
                </div>
              </div>
              
              {/* Footer */}
              <div className="flex justify-end p-6 border-t border-gray-200">
                <button
                  onClick={onClose}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  I Understand
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default TermsAndConditionsModal;
