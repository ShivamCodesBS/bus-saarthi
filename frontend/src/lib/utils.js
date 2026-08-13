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
