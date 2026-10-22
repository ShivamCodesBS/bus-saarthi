/**
 * Central, human-readable error handling.
 *
 * The rule: a user NEVER sees a raw technical message. Backend errors are
 * mapped to plain language, and anything unrecognised falls back to a safe
 * generic message. The technical detail still goes to the console for
 * debugging, it is just never shown on screen.
 */

/** Backend error responses that are safe and useful to show as-is. */
const FRIENDLY = {
  'Invalid login ID or password': 'That login ID and password do not match. Please try again.',
  'Invalid credentials or server unreachable.':
    'We could not sign you in. Please check your details and try again.',
  'You are not allowed to create an account with the role':
    'You do not have permission to create an account with that role.',
  'You are not allowed to change this account to the role':
    'You do not have permission to give that account that role.',
  'You can only change your own password':
    'You can only change your own password.',
  'Only an admin can delete an administrator account':
    'You do not have permission to delete that account.',
  'This complaint is already awaiting confirmation':
    'This complaint is already waiting for the complainant to confirm it.',
  'Only the person who raised this complaint can confirm it':
    'Only the person who raised this complaint can confirm it.',
  'Only a complaint that is awaiting your confirmation can be reopened':
    'This complaint is not waiting for a confirmation.',
  'You cannot agree with your own complaint':
    'You cannot agree with your own complaint.',
  'You are not allocated to a bus route yet':
    'You are not allocated to a bus route yet, so a complaint cannot be filed.',
  'Only a student account can have a parent linked to it':
    'Only a student account can have a parent linked to it.',
  'Child not linked to this parent account':
    'That student is not linked to your account.',
  'Child not found or not a passenger':
    'That student could not be found.',
  'Parent account not found': 'That parent account could not be found.',
  'User not found': 'That user could not be found.',
  'Grievance not found': 'That complaint could not be found.',
  'Route not found': 'That route could not be found.',
  'Cannot merge a route into itself':
    'A route cannot be merged into itself.',
  'Cannot delete route': 'That route cannot be deleted.',
  'SOS alert already triggered recently. Please wait.':
    'An SOS was already sent recently. Please wait a moment.',
  'Current password is incorrect':
    'Your current password is not correct.',
};

/**
 * Turn any thrown value into a message that is safe to show a user.
 *
 * @param {unknown} err       the caught error
 * @param {string}   fallback the message to use when nothing better is known
 */
export function friendlyError(err, fallback = 'Something went wrong. Please try again.') {
  // Network failures — the request never reached the server.
  if (err?.name === 'AxiosError' || err?.isAxiosError) {
    if (!err.response) {
      return 'We could not reach the server. Please check your connection and try again.';
    }
    const status = err.response.status;

    if (status === 401) {
      return 'Your session has expired. Please sign in again.';
    }
    if (status === 403) {
      return 'You do not have permission to do that.';
    }
    if (status === 404) {
      return 'We could not find what you were looking for.';
    }
    if (status === 409) {
      return 'That already exists. Please use a different name.';
    }
    if (status === 429) {
      return 'Too many attempts. Please wait a moment and try again.';
    }
    if (status >= 500) {
      return 'The server had a problem. Please try again in a moment.';
    }
  }

  // A validation error from the backend: `message` is an array of strings.
  const data = err?.response?.data;
  const raw = Array.isArray(data?.message)
    ? data.message[0]
    : (data?.message || data?.detail || data?.error);

  if (typeof raw === 'string' && raw) {
    // Exact match on a known-safe message.
    if (FRIENDLY[raw]) return FRIENDLY[raw];

    // The backend prefixes role errors with the raw role name.
    for (const [needle, friendly] of Object.entries(FRIENDLY)) {
      if (raw.includes(needle)) return friendly;
    }

    // A validation message from class-validator is already written for
    // humans, but it can contain property paths. Clean it up a little.
    if (raw.length <= 120 && !/^[\w.]+\s+(must|should|is required)/.test(raw)) {
      return raw;
    }
    return fallback;
  }

  return fallback;
}

/**
 * Log the technical detail to the console and return a message safe to show.
 */
export function reportError(err, context = '') {
  // eslint-disable-next-line no-console
  console.error(
    `[${context || 'app'}]`,
    err?.response?.status ?? '',
    err?.response?.data ?? err?.message ?? err,
  );
  return friendlyError(err);
}
