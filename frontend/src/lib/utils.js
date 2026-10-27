import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function parseApiError(err, defaultMsg = "An unexpected error occurred") {
  if (err?.response?.data) {
    const data = err.response.data;
    if (Array.isArray(data.message)) {
      return data.message[0]; // Return the first validation error
    }
    if (typeof data.message === 'string') return data.message;
    if (typeof data.error === 'string') return data.error;
    if (typeof data.detail === 'string') return data.detail;
  }
  return err?.message || defaultMsg;
}

/**
 * The backend runs a global `ValidationPipe` with `forbidNonWhitelisted: true`
 * and `whitelist: true` (see backend/src/main.ts). Two consequences:
 *
 *  1. Any property the DTO does not declare causes the WHOLE request to be
 *     rejected with a 400.
 *  2. A field declared as a date or a number is rejected when it arrives as
 *     an empty string (the forms keep empty inputs as '').
 *
 * This helper strips everything the API would reject, so the forms can keep
 * their full state shape without the server refusing the save.
 */
export function sanitizePayload(payload, allowedKeys) {
  const out = {};
  for (const key of allowedKeys) {
    const value = payload?.[key];
    if (value === undefined || value === null) continue;
    // Empty strings are invalid for dates, numbers and enums alike.
    if (typeof value === 'string' && value.trim() === '') continue;
    out[key] = value;
  }
  return out;
}

/**
 * Keys accepted by POST /api/users and PUT /api/users/:loginId.
 *
 * Note what is NOT here: `parentPassword` and `createParentAccount` are
 * client-side only (the parent account is created through
 * POST /api/parents/create-and-link), and sending them used to make every
 * user save fail with a 400.
 */
export const USER_PAYLOAD_KEYS = [
  'name',
  'login_id',
  'password',
  'role',
  'route_id',
  'fee_status',
  'phone',
  'email',
  'designation',
  'subject',
  'licenseNumber',
  'licenseExpiry',
  'experienceYears',
  'bloodGroup',
  'parentName',
  'parentPhone',
  'dob',
  'address',
  'gradeClass',
  'profile_pic',
  'location_lat',
  'location_lng',
];

/**
 * The FeeStatus enum on the backend is `paid | unpaid | partial`. Any other
 * value (for example the old "pending") is rejected with a 400 by the
 * validation pipe, which is why saving an unpaid student used to throw.
 */
export const FEE_STATUSES = ['paid', 'unpaid', 'partial'];

/** Normalise whatever the UI or a CSV row used into a valid FeeStatus. */
export function normalizeFeeStatus(value) {
  const v = String(value ?? '').trim().toLowerCase();
  if (!v) return 'unpaid';
  if (v === 'paid' || v === 'payment done' || v === 'complete') return 'paid';
  if (v === 'partial' || v === 'partially paid' || v === 'half') return 'partial';
  // "pending", "unpaid", "not paid" and anything unknown mean unpaid.
  return 'unpaid';
}

/**
 * Format SOS alert time consistently in Indian Standard Time (IST).
 * Prevents UTC server offsets from displaying morning times for afternoon/evening alerts.
 */
export function formatSosTime(timestamp, fallbackTime) {
  if (timestamp) {
    const d = new Date(timestamp);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    }
  }
  if (fallbackTime && typeof fallbackTime === 'string') {
    if (fallbackTime.includes('T') || fallbackTime.includes('-')) {
      const d = new Date(fallbackTime);
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        });
      }
    }
    return fallbackTime;
  }
  return new Date().toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}
