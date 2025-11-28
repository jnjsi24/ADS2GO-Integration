import React, { useState, useEffect } from 'react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason?: string) => void;
  title?: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  confirmButtonClass?: string;
  isProcessing?: boolean;
  requireTitleConfirmation?: boolean;
  confirmationTitle?: string;
  requireReason?: boolean;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirm Action",
  message,
  confirmText = "OK",
  cancelText = "Cancel",
  confirmButtonClass = "bg-red-600 hover:bg-red-700",
  isProcessing = false,
  requireTitleConfirmation = false,
  confirmationTitle = "",
  requireReason = false
}) => {
  const [inputValue, setInputValue] = useState('');
  const [reasonValue, setReasonValue] = useState('');
  const [isValid, setIsValid] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setInputValue('');
      setReasonValue('');
      // Set initial validity based on requirements
      if (requireTitleConfirmation || requireReason) {
        setIsValid(false);
      } else {
        setIsValid(true);
      }
    }
  }, [isOpen, requireTitleConfirmation, requireReason]);

  useEffect(() => {
    if (requireTitleConfirmation && confirmationTitle) {
      const titleMatches = inputValue.trim() === confirmationTitle.trim();
      const reasonProvided = requireReason ? reasonValue.trim().length > 0 : true;
      setIsValid(titleMatches && reasonProvided);
    } else if (requireReason) {
      setIsValid(reasonValue.trim().length > 0);
    } else {
      setIsValid(true);
    }
  }, [inputValue, reasonValue, requireTitleConfirmation, confirmationTitle, requireReason]);

  const handleConfirm = () => {
    if (isValid && !isProcessing) {
      onConfirm(requireReason ? reasonValue.trim() : undefined);
      setInputValue('');
      setReasonValue('');
    }
  };

  const handleClose = () => {
    setInputValue('');
    setReasonValue('');
    setIsValid(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {title}
          </h3>
          <p className="text-gray-600 mb-6">
            {message}
          </p>
          
          {requireTitleConfirmation && confirmationTitle && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type <span className="font-semibold text-gray-900">"{confirmationTitle}"</span> to confirm:
              </label>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && isValid && !isProcessing) {
                    handleConfirm();
                  }
                }}
                placeholder="Enter ad title"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                autoFocus
              />
              {inputValue && !isValid && requireTitleConfirmation && (
                <p className="mt-1 text-sm text-red-600">
                  The entered text does not match the ad title.
                </p>
              )}
            </div>
          )}

          {requireReason && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for deletion <span className="text-red-600">*</span>:
              </label>
              <textarea
                value={reasonValue}
                onChange={(e) => setReasonValue(e.target.value)}
                placeholder="Please provide a reason for deleting this advertisement (e.g., Campaign ended, Budget constraints, etc.)"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
              />
              {!reasonValue.trim() && requireReason && (
                <p className="mt-1 text-sm text-red-600">
                  Please provide a reason for deletion.
                </p>
              )}
            </div>
          )}

          <div className={`flex ${cancelText ? 'justify-between' : 'justify-end'} space-x-3`}>
            {cancelText && (
              <button
                onClick={handleClose}
                disabled={isProcessing}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {cancelText}
              </button>
            )}
            <button
              onClick={handleConfirm}
              disabled={isProcessing || !isValid}
              className={`px-4 py-2 text-white rounded-lg font-medium transition-colors flex items-center gap-2 ${
                isProcessing || !isValid
                  ? 'bg-gray-400 cursor-not-allowed'
                  : confirmButtonClass
              }`}
            >
              {isProcessing && (
                <div className="w-4 h-4 animate-spin border-2 border-white border-t-transparent rounded-full" />
              )}
              {isProcessing ? 'Processing...' : confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
export default ConfirmationModal;

