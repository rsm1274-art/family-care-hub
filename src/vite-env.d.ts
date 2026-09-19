/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * OAuth client ID for Google Drive sync, from a Google Cloud project you
   * (the deployer) create. Optional: with it unset, cloud sync is simply not
   * offered. See README.md for setup.
   */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
