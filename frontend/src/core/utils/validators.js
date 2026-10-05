const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const PHONE_RE = /^\+?[0-9]{7,15}$/;
const PINCODE_RE = /^[1-9][0-9]{5}$/;
const EMPLOYEE_CODE_RE = /^[A-Z0-9_-]{3,20}$/i;
const BANK_ACCOUNT_RE = /^[0-9]{9,18}$/;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;

export const MAX_FILE_SIZE = {
  image: 2 * 1024 * 1024,
  document: 5 * 1024 * 1024,
  resume: 5 * 1024 * 1024,
  spreadsheet: 10 * 1024 * 1024,
  archive: 25 * 1024 * 1024,
};

export const cleanPhone = (value = '') => String(value).replace(/[\s\-().]/g, '');

export const isEmail = (value = '') => EMAIL_RE.test(String(value).trim());

export const isPhone = (value = '') => PHONE_RE.test(cleanPhone(value));

export const isPan = (value = '') => PAN_RE.test(String(value).trim().toUpperCase());

export const isPincode = (value = '') => PINCODE_RE.test(String(value).trim());

export const isEmployeeCode = (value = '') => EMPLOYEE_CODE_RE.test(String(value).trim());

export const isBankAccount = (value = '') => BANK_ACCOUNT_RE.test(String(value).trim());

export const isIfsc = (value = '') => IFSC_RE.test(String(value).trim().toUpperCase());

// ── Base validation functions (defined before aliases) ──
export const isNonEmpty = (value) => String(value ?? '').trim().length > 0;

export const isNonNegativeNumber = (value) => {
  if (value === '' || value === null || value === undefined) return false;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0;
};

export const isPositiveNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0;
};

// Converts DD-MM-YYYY → YYYY-MM-DD so the JS Date constructor parses it correctly.
// Any other format is returned unchanged.
const normaliseDateString = (value = '') => {
  const ddmmyyyy = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value);
  if (ddmmyyyy) return `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`;
  return value;
};

export const isDateString = (value = '') => {
  if (!value) return false;
  const d = new Date(normaliseDateString(value));
  return !Number.isNaN(d.getTime());
};

export const isAtLeastAge = (value, minAge = 18) => {
  if (!isDateString(value)) return false;
  const dob = new Date(normaliseDateString(value));
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age -= 1;
  return age >= minAge;
};

export const isFutureDate = (value) => {
  if (!isDateString(value)) return false;
  const d = new Date(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d > today;
};

export const isValidUrl = (value = '') => {
  if (!String(value).trim()) return true;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
};

export const getFileExtension = (fileOrName) => {
  const name = typeof fileOrName === 'string' ? fileOrName : fileOrName?.name || '';
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot).toLowerCase() : '';
};

export const validateFile = (file, allowedExts, maxSize, label = 'File') => {
  if (!file) return `${label} is required.`;
  const ext = getFileExtension(file);
  const allowed = allowedExts.map(e => e.toLowerCase());
  if (!allowed.includes(ext)) return `${label} must be ${allowedExts.join(', ')}.`;
  if (maxSize && file.size > maxSize) {
    return `${label} must be ${(maxSize / (1024 * 1024)).toFixed(0)}MB or smaller.`;
  }
  return '';
};

export const validatePassword = (password = '') => {
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Z]/.test(password)) return 'Password must include one uppercase letter.';
  if (!/[a-z]/.test(password)) return 'Password must include one lowercase letter.';
  if (!/[0-9]/.test(password)) return 'Password must include one number.';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Password must include one special character.';
  return '';
};

export const validateFirstError = (checks) => {
  for (const check of checks) {
    const message = typeof check === 'function' ? check() : check;
    if (message) return message;
  }
  return '';
};

// ── Date After (DOJ >= DOB) ──
export const isDateAfter = (date1, date2) => {
  if (!date1 || !date2) return false;
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return d1 >= d2;
};

// ── Date in past ──
export const isDateInPast = (value) => {
  if (!isDateString(value)) return false;
  const d = new Date(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
};

// ── ALIASES (must be defined AFTER the base functions) ──

// Alias for isBankAccount
export const isValidBankAccount = isBankAccount;

// Alias for isPhone
export const isValidPhone = isPhone;

// Alias for isPan
export const isValidPAN = isPan;

// Alias for isIfsc
export const isValidIFSC = isIfsc;

// Alias for isPincode
export const isValidPincode = isPincode;

// Alias for isEmail
export const isValidEmail = isEmail;

// Alias for isValidUrl (must come AFTER isValidUrl is defined)
export const isValidURL = isValidUrl;

// Alias for isDateString
export const isValidDate = isDateString;

/**
 * Safely extracts a user-readable string error message from any backend response,
 * Error object, or FastAPI/Pydantic validation error array.
 *
 * Prevents React Error #31 ("Objects are not valid as a React child") when passing
 * raw error responses or objects to toast.error() or JSX.
 *
 * @param {any} error - The error value (string, object, array, Error instance)
 * @param {string} fallback - Fallback message if extraction yields nothing
 * @returns {string}
 */
export function extractErrorMessage(error, fallback = 'An unexpected error occurred.') {
  if (!error) return fallback;
  if (typeof error === 'string') return error.trim() || fallback;

  if (error instanceof Error) {
    return error.message || fallback;
  }

  const detail = error.detail !== undefined ? error.detail : (error.response?.data?.detail ?? error.message);
  if (detail && typeof detail === 'string') return detail.trim() || fallback;

  if (Array.isArray(detail)) {
    const messages = detail
      .map(item => {
        if (!item) return null;
        if (typeof item === 'string') return item;
        if (typeof item === 'object') {
          const loc = Array.isArray(item.loc)
            ? item.loc.filter(l => l !== 'body').join('.')
            : '';
          const msg = item.msg || item.message || JSON.stringify(item);
          return loc ? `${loc}: ${msg}` : msg;
        }
        return String(item);
      })
      .filter(Boolean);

    if (messages.length > 0) return messages.join(' | ');
  }

  if (typeof detail === 'object' && detail !== null) {
    if (detail.msg) return String(detail.msg);
    if (detail.message) return String(detail.message);
    try {
      return JSON.stringify(detail);
    } catch {
      return fallback;
    }
  }

  return String(error || fallback);
}