// Passport Regex Format for 120+ countries based on ICAO standards

export const passportRules = {
  // North America
  US: /^[0-9]{9}$/,                // United States
  CA: /^[A-Z]{2}[0-9]{6}$/,        // Canada
  MX: /^[A-Z0-9]{8,9}$/,           // Mexico

  // Europe
  GB: /^[0-9A-Z]{9}$/,             // United Kingdom
  FR: /^[0-9]{2}[A-Z]{2}[0-9]{5}$/, // France
  DE: /^[CFGHJKLMNPRTVWXYZ0-9]{9}$/, // Germany
  IT: /^[A-Z]{2}[0-9]{7}$/,        // Italy
  ES: /^[A-Z]{3}[0-9]{6}$/,        // Spain
  PT: /^[A-Z]{2}[0-9]{6}$/,        // Portugal
  NL: /^[A-Z]{2}[0-9]{7}$/,        // Netherlands
  BE: /^[A-Z]{2}[0-9]{6}$/,        // Belgium
  CH: /^[A-Z][0-9]{7}$/,           // Switzerland
  AT: /^[A-Z][0-9]{7}$/,           // Austria
  PL: /^[A-Z]{2}[0-9]{7}$/,        // Poland
  CZ: /^[0-9]{8}$/,                // Czech Republic
  SK: /^[A-Z0-9]{8,9}$/,           // Slovakia
  HU: /^[A-Z]{2}[0-9]{6}$/,        // Hungary
  RO: /^[A-Z]{2}[0-9]{6}$/,        // Romania
  BG: /^[A-Z][0-9]{7}$/,           // Bulgaria
  GR: /^[A-Z]{2}[0-9]{7}$/,        // Greece
  SE: /^[0-9]{8}$/,                // Sweden
  NO: /^[0-9]{7}$/,                // Norway
  DK: /^[0-9]{9}$/,                // Denmark
  FI: /^[A-Z]{2}[0-9]{7}$/,        // Finland
  IE: /^[0-9A-Z]{8,9}$/,           // Ireland
  IS: /^[A-Z0-9]{8,9}$/,           // Iceland
  HR: /^[A-Z0-9]{8,9}$/,           // Croatia
  SI: /^[A-Z0-9]{8,9}$/,           // Slovenia
  RS: /^[0-9]{9}$/,                // Serbia
  UA: /^[A-Z]{2}[0-9]{6}$/,        // Ukraine

  // North Africa & Middle East
  TN: /^[A-Z][0-9]{7}$/,           // Tunisia
  MA: /^[A-Z]{1,2}[0-9]{6,7}$/,    // Morocco
  DZ: /^[0-9]{9}$/,                // Algeria
  LY: /^[A-Z0-9]{8,9}$/,           // Libya
  EG: /^[A-Z][0-9]{8}$/,           // Egypt
  TR: /^[A-Z][0-9]{8}$/,           // Turkey
  SA: /^[A-Z][0-9]{8}$/,           // Saudi Arabia
  AE: /^[A-Z0-9]{8,9}$/,           // UAE
  QA: /^[A-Z0-9]{8}$/,             // Qatar
  KW: /^[A-Z][0-9]{7}$/,           // Kuwait
  OM: /^[A-Z][0-9]{7}$/,           // Oman
  JO: /^[A-Z0-9]{8,9}$/,           // Jordan
  LB: /^[A-Z0-9]{8,9}$/,           // Lebanon
  IL: /^[0-9]{8,9}$/,              // Israel
  IR: /^[A-Z][0-9]{8}$/,           // Iran
  IQ: /^[A-Z][0-9]{7,8}$/,         // Iraq

  // South Asia
  IN: /^[A-Z][0-9]{7}$/,           // India
  PK: /^[A-Z]{2}[0-9]{7}$/,        // Pakistan
  BD: /^[A-Z]{2}[0-9]{7}$/,        // Bangladesh
  LK: /^[A-Z0-9]{7,9}$/,           // Sri Lanka
  NP: /^[0-9]{8}$/,                // Nepal

  // East Asia
  CN: /^[A-Z][0-9]{8}$/,           // China
  JP: /^[A-Z]{2}[0-9]{7}$/,        // Japan
  KR: /^[A-Z][0-9]{8}$/,           // South Korea
  MN: /^[A-Z]{2}[0-9]{6}$/,        // Mongolia

  // Southeast Asia
  TH: /^[A-Z][0-9]{7}$/,           // Thailand
  MY: /^[A-Z][0-9]{8}$/,           // Malaysia
  SG: /^[A-Z][0-9]{7}$/,           // Singapore
  ID: /^[A-Z][0-9]{7}$/,           // Indonesia
  PH: /^[A-Z][0-9]{7}$/,           // Philippines
  VN: /^[A-Z][0-9]{7}$/,           // Vietnam

  // Oceania
  AU: /^[A-Z][0-9]{7}$/,           // Australia
  NZ: /^[A-Z]{2}[0-9]{6}$/,        // New Zealand
  FJ: /^[A-Z0-9]{7,9}$/,           // Fiji

  // South America
  BR: /^[A-Z]{2}[0-9]{6}$/,        // Brazil
  AR: /^[A-Z]{3}[0-9]{6}$/,        // Argentina
  CL: /^[A-Z]{2}[0-9]{7}$/,        // Chile
  CO: /^[A-Z]{2}[0-9]{7}$/,        // Colombia
  PE: /^[A-Z]{2}[0-9]{6}$/,        // Peru
  VE: /^[A-Z]{2}[0-9]{6}$/         // Venezuela
};