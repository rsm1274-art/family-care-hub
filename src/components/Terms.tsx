import React from 'react';

// This component renders the Terms of Service and Privacy Statement.
// UPDATED: Uses standard window navigation to avoid build errors.
const Terms: React.FC = () => {
  
  // We use this simple function to go back to the home page
  const goHome = () => {
    // This sends the user back to your main GitHub Pages folder
    window.location.href = '/family-care-hub/';
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      {/* Container for content - centered and constrained for readability */}
      <div className="max-w-4xl mx-auto bg-white shadow-xl rounded-2xl p-6 sm:p-10">
        
        {/* --- BACK BUTTON --- */}
        <button 
          onClick={goHome}
          className="mb-6 flex items-center text-blue-600 hover:text-blue-800 font-semibold transition-colors"
        >
          <span className="mr-2">←</span> Back to Home
        </button>

        <header className="mb-8 border-b pb-4">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-blue-700">
            Family Care Hub Policies
          </h1>
          <p className="text-lg text-gray-500 mt-2">
            Important legal information regarding your use of the application.
          </p>
        </header>

        {/* --- Terms of Service Section --- */}
        <section className="mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-4">
            Terms of Service for Family Care Hub
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            Effective Date: November 23, 2025
          </p>
          <p className="mb-4 text-gray-700 leading-relaxed">
            Welcome to Family Care Hub! This application is designed to function as a private, local repository for personal medical information. Please read these Terms of Service carefully, as they govern your use of the application.
          </p>

          <h3 className="text-xl font-semibold text-gray-700 mt-6 mb-2">1. Acceptance of Terms</h3>
          <p className="mb-4 text-gray-700 leading-relaxed">
            By accessing or using the Family Care Hub web application (the "Service"), you agree to be bound by these Terms of Service (the "Terms"). If you disagree with any part of the terms, you may not use the Service.
          </p>

          <h3 className="text-xl font-semibold text-gray-700 mt-6 mb-2">2. The Nature of the Service</h3>
          <ul className="list-disc list-inside space-y-2 pl-5 text-gray-700 leading-relaxed">
            <li>
              <span className="font-medium">Local Storage Only:</span> The Service is a single-page web application designed to run entirely on your local device (computer, tablet, or smartphone). All user input, including personal and medical information, is encrypted and stored exclusively in the local storage mechanisms of your web browser or operating system.
            </li>
            <li>
              <span className="font-medium">No Server-Side Communication:</span> The Service is explicitly designed not to transmit any user data, personal information, or medical records to our servers, third-party servers, or any external network location. We do not have access to, nor do we store, any of your data.
            </li>
          </ul>

          <h3 className="text-xl font-semibold text-gray-700 mt-6 mb-2">3. User Responsibilities for Data and Security</h3>
          <h4 className="text-lg font-medium text-gray-700 mt-4 mb-1">A. Data Security and Encryption</h4>
          <p className="mb-2 text-gray-700 leading-relaxed">
            While the data is stored in a private, encrypted format on your device, you are solely responsible for the physical and digital security of the device on which the Service is used. This includes, but is not limited to:
          </p>
          <ul className="list-disc list-inside space-y-1 pl-10 text-gray-700 leading-relaxed">
            <li>Protecting your device from unauthorized access.</li>
            <li>Maintaining strong passwords or biometric controls for your device.</li>
          </ul>

          <h4 className="text-lg font-medium text-gray-700 mt-4 mb-1">B. Data Loss and Recovery</h4>
          <p className="mb-2 text-gray-700 leading-relaxed">
            We cannot recover your data. Because your data is stored only on your local device and is never transmitted to us, the Service provides no means for password reset, account recovery, or data backup. Data lost due to device failure, clearing of browser data/cache, or accidental deletion is permanently unrecoverable by Family Care Hub or its developers.
          </p>

          <h4 className="text-lg font-medium text-gray-700 mt-4 mb-1">C. Backup Responsibility</h4>
          <p className="mb-4 text-gray-700 leading-relaxed">
            You are solely responsible for creating and maintaining independent, secure backups of your data stored within the Service, if such functionality is provided.
          </p>

          <h3 className="text-xl font-semibold text-gray-700 mt-6 mb-2">4. Disclaimer of Warranties</h3>
          <p className="mb-4 text-gray-700 leading-relaxed">
            The Service is provided on an "as-is" and "as available" basis. We make no warranties, expressed or implied, regarding the operation or availability of the Service, or the accuracy, reliability, or completeness of any content or information stored by you.
          </p>

          <h3 className="text-xl font-semibold text-gray-700 mt-6 mb-2">5. Limitation of Liability</h3>
          <p className="mb-2 text-gray-700 leading-relaxed">
            In no event shall Family Care Hub, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any direct, indirect, incidental, special, consequential, or punitive damages, including without limitation, loss of data, profits, or other intangible losses, resulting from:
          </p>
          <ul className="list-disc list-inside space-y-1 pl-10 text-gray-700 leading-relaxed">
            <li>Your access to or use of, or inability to access or use, the Service.</li>
            <li>The loss of your locally stored data.</li>
            <li>Any unauthorized access to or use of your locally stored data, as we have no control over the physical security of your device.</li>
          </ul>

          <h3 className="text-xl font-semibold text-gray-700 mt-6 mb-2">6. Changes to Terms</h3>
          <p className="mb-4 text-gray-700 leading-relaxed">
            We reserve the right, at our sole discretion, to modify or replace these Terms at any time. By continuing to access or use our Service after those revisions become effective, you agree to be bound by the revised terms.
          </p>
        </section>

        {/* --- Privacy Statement Section --- */}
        <section className="border-t pt-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-4">
            Privacy Statement for Family Care Hub
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            Effective Date: November 23, 2025
          </p>
          <p className="mb-4 text-gray-700 leading-relaxed">
            This Privacy Statement explains how Family Care Hub handles user data. Given the fundamental design of our application, this agreement is exceptionally simple:
          </p>

          <h3 className="text-xl font-semibold text-gray-700 mt-6 mb-2">1. Data Collection and Storage Policy</h3>
          <p className="mb-2 text-gray-700 leading-relaxed font-medium">
            We do not collect or transmit your Personal Information or Health Information.
          </p>
          <h4 className="text-lg font-medium text-gray-700 mt-4 mb-1">A. Local Storage Only</h4>
          <p className="mb-2 text-gray-700 leading-relaxed">
            The core function of Family Care Hub is to store personal data and sensitive medical information. This data is stored exclusively on your local device (e.g., your computer's browser storage, device file system) and is never transmitted to any external server, including those operated by Family Care Hub or any third-party.
          </p>
          <h4 className="text-lg font-medium text-gray-700 mt-4 mb-1">B. Definition of No-Transfer</h4>
          <ul className="list-disc list-inside space-y-2 pl-5 text-gray-700 leading-relaxed">
            <li>
              <span className="font-medium">No Information is Transferred:</span> We do not collect, capture, transmit, share, sell, or otherwise transfer any personal identifying information, health information, or usage statistics to any network server.
            </li>
            <li>
              <span className="font-medium">No Third-Party Analytics:</span> The application does not utilize third-party analytics services (e.g., Google Analytics, etc.) that would require transferring your IP address or usage data.
            </li>
          </ul>

          <h3 className="text-xl font-semibold text-gray-700 mt-6 mb-2">2. Your Control Over Data</h3>
          <p className="mb-2 text-gray-700 leading-relaxed">
            Since the data resides solely on your device, you are the exclusive controller of that data.
          </p>
          <ul className="list-disc list-inside space-y-1 pl-10 text-gray-700 leading-relaxed">
            <li><span className="font-medium">Access and Modification:</span> You can access, modify, and delete your information through the application interface.</li>
            <li><span className="font-medium">Deletion:</span> Deleting the application, clearing your browser's data/cache, or deleting the files associated with the Service will permanently erase your data.</li>
          </ul>

          <h3 className="text-xl font-semibold text-gray-700 mt-6 mb-2">3. Data Security and Responsibility</h3>
          <p className="mb-2 text-gray-700 leading-relaxed">
            We implement security measures within the application (such as encryption and password protection) to protect data while it is stored locally on your device.
          </p>
          <p className="mb-4 text-gray-700 leading-relaxed">
            However, the security of your device is entirely your responsibility. Family Care Hub cannot protect your data from physical theft of your device, unauthorized access to your operating system, or device-specific malware.
          </p>

          <h3 className="text-xl font-semibold text-gray-700 mt-6 mb-2">4. No Children's Data Collection</h3>
          <p className="mb-4 text-gray-700 leading-relaxed">
            Given that we collect no data from any user, we cannot collect data from children under the age of 13. The Service is not directed to individuals under 18 years of age.
          </p>
        </section>

      </div>
    </div>
  );
};

export { Terms };
