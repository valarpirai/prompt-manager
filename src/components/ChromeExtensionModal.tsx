'use client';

import { useState } from 'react';

interface ChromeExtensionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ChromeExtensionModal({
  isOpen,
  onClose,
}: ChromeExtensionModalProps) {
  const [currentStep, setCurrentStep] = useState(0);

  if (!isOpen) return null;

  const steps = [
    {
      title: 'Download the Extension',
      content: (
        <div className="space-y-4">
          <p className="text-gray-700">
            First, download the Chrome extension ZIP file from our GitHub
            repository.
          </p>
          <a
            href="https://github.com/valarpirai/prompt-manager/tree/main/chrome_extension.zip"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            Download chrome_extension.zip
          </a>
          <p className="text-sm text-gray-600">
            Extract the ZIP file to a folder on your computer (e.g., Desktop or
            Documents).
          </p>
        </div>
      ),
    },
    {
      title: 'Open Chrome Extensions',
      content: (
        <div className="space-y-4">
          <p className="text-gray-700">
            Open Chrome and navigate to the extensions page:
          </p>
          <div className="bg-gray-50 p-4 rounded-md">
            <p className="font-mono text-sm">chrome://extensions/</p>
          </div>
          <p className="text-sm text-gray-600">
            Or go to Chrome menu → More tools → Extensions
          </p>
        </div>
      ),
    },
    {
      title: 'Enable Developer Mode',
      content: (
        <div className="space-y-4">
          <p className="text-gray-700">
            In the Chrome Extensions page, enable Developer mode:
          </p>
          <ul className="list-disc list-inside space-y-2 text-gray-600">
            <li>
              Look for the &ldquo;Developer mode&rdquo; toggle in the top-right
              corner
            </li>
            <li>Click to enable it (it should turn blue/on)</li>
          </ul>
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3">
            <p className="text-sm text-yellow-700">
              <strong>Note:</strong> This is safe and only allows you to load
              extensions from your computer.
            </p>
          </div>
        </div>
      ),
    },
    {
      title: 'Load the Extension',
      content: (
        <div className="space-y-4">
          <p className="text-gray-700">
            Now load the extension you downloaded:
          </p>
          <ul className="list-disc list-inside space-y-2 text-gray-600">
            <li>Click the &ldquo;Load unpacked&rdquo; button that appears</li>
            <li>Browse to and select the extracted extension folder</li>
            <li>Make sure you select the folder containing `manifest.json`</li>
          </ul>
        </div>
      ),
    },
    {
      title: 'Verify Installation',
      content: (
        <div className="space-y-4">
          <p className="text-gray-700">Confirm the extension is installed:</p>
          <ul className="list-disc list-inside space-y-2 text-gray-600">
            <li>The extension should appear in your extensions list</li>
            <li>
              You should see the Prompt Manager icon in your Chrome toolbar
            </li>
            <li>
              If you don&rsquo;t see the icon, click the puzzle piece icon and
              pin the extension
            </li>
          </ul>
          <div className="bg-green-50 border-l-4 border-green-400 p-3">
            <p className="text-sm text-green-700">
              <strong>Success!</strong> You can now use the extension by typing{' '}
              <code className="bg-green-100 px-1 rounded">::promptname</code> in
              any text field and pressing Tab.
            </p>
          </div>
        </div>
      ),
    },
  ];

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const resetAndClose = () => {
    setCurrentStep(0);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Install Chrome Extension
              </h2>
              <p className="text-gray-600 mt-1">
                Step {currentStep + 1} of {steps.length}
              </p>
            </div>
            <button
              onClick={resetAndClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex items-center">
              {steps.map((_, index) => (
                <div key={index} className="flex items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      index <= currentStep
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {index + 1}
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`h-1 w-full mx-2 ${
                        index < currentStep ? 'bg-blue-600' : 'bg-gray-200'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Step Content */}
          <div className="mb-8">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              {steps[currentStep].title}
            </h3>
            {steps[currentStep].content}
          </div>

          {/* Navigation Buttons */}
          <div className="flex justify-between items-center">
            <button
              onClick={prevStep}
              disabled={currentStep === 0}
              className={`px-4 py-2 rounded-md transition-colors ${
                currentStep === 0
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Previous
            </button>

            <div className="flex space-x-3">
              {currentStep === steps.length - 1 ? (
                <button
                  onClick={resetAndClose}
                  className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                >
                  Done
                </button>
              ) : (
                <button
                  onClick={nextStep}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Next
                </button>
              )}
            </div>
          </div>

          {/* Help Text */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="bg-blue-50 p-4 rounded-md">
              <h4 className="font-medium text-blue-900 mb-2">Need Help?</h4>
              <p className="text-sm text-blue-700">
                If you encounter any issues during installation, check the{' '}
                <a
                  href="https://github.com/valarpirai/prompt-manager/tree/main/chrome_extension"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:no-underline"
                >
                  full documentation
                </a>{' '}
                or ensure Chrome is up to date.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
