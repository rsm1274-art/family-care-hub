<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1KkwTIntX6iqS-BgHDvVn4mwdD0KqGMdY

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

# Family Care Hub

## Overview
Family Care Hub is a secure application designed to help caregivers manage and share critical medical information. The app ensures that sensitive data is protected while remaining accessible in emergencies.

---

## Security Features

### 1. **Data Encryption**
- **Local Storage Encryption**: All user data is encrypted using AES (Advanced Encryption Standard) before being stored locally. This ensures that even if the storage is accessed, the data remains unreadable without the encryption key.
- **Encryption Keys**: Keys are securely generated and managed by the app, ensuring they are not exposed.

### 2. **Role-Based Access Control (RBAC)**
- **Multi-Caregiver Permissions**: Different caregivers (e.g., parents, babysitters, schools) are assigned specific roles with defined access levels.
- **Granular Permissions**: Users can control who can view, edit, or share specific data.

### 3. **Secure Sharing**
- **One-Time Access Links**: Temporary, secure links are generated for external caregivers (e.g., babysitters, schools). These links expire after a single use or a set time.
- **QR Code Sharing**: Emergency information can be shared via QR codes, ensuring quick access without compromising security.

### 4. **Emergency Access**
- **Lock Screen Widget**: Critical information (e.g., allergies, emergency contacts) is accessible via a lock screen widget or QR code without requiring a password.
- **Read-Only Mode**: Emergency access is restricted to viewing essential data only.

### 5. **Data Integrity**
- **Tamper Detection**: The app detects and alerts users if data has been modified outside the app.
- **Backup and Restore**: Encrypted backups ensure data can be restored without exposure.

### 6. **Privacy by Design**
- **No Cloud Storage**: All data is stored locally on the user's device, eliminating risks associated with cloud breaches.
- **Minimal Data Collection**: The app collects only the data necessary for its functionality.

---

## How It Protects User Data

1. **Encryption at Rest**:
   - All data stored locally is encrypted using AES-256.
   - Encryption keys are derived from user-defined PINs, ensuring only authorized users can decrypt the data.

2. **Encryption in Transit**:
   - When sharing data (e.g., via QR codes or one-time links), the app uses HTTPS to secure the transmission.

3. **Secure Authentication**:
   - The app uses a PIN-based authentication system to unlock access.
   - PINs are hashed and never stored directly.

4. **Regular Security Audits**:
   - The app undergoes regular code reviews and security audits to identify and fix vulnerabilities.

5. **User Control**:
   - Users have full control over their data, including the ability to delete it permanently.
   - Sharing features are opt-in and require explicit user consent.

---

## Disclaimer
Family Care Hub is designed to prioritize user privacy and security. However, users are encouraged to follow best practices, such as using strong PINs and keeping their devices secure.

For questions or support, please contact our team.
