import { cn } from '@/lib/utils';

/**
 * The initials shown when an account has no picture.
 *
 * Every avatar in the app falls back to this, so a user without a picture
 * never sees an empty circle.
 */
export function initialsOf(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/**
 * A user's avatar.
 *
 * Shows the uploaded picture when there is one, and their initials on a
 * coloured disc otherwise.
 */
export default function UserAvatar({
  src,
  name,
  size = 40,
  className,
  style,
  textClassName = 'text-white',
}) {
  const picture = src || null;

  return (
    <div
      className={cn(
        'relative flex items-center justify-center overflow-hidden rounded-full shrink-0',
        className,
      )}
      style={{
        width: size,
        height: size,
        background: picture
          ? 'var(--bg-color)'
          : 'linear-gradient(135deg, #3b82f6, #8b5cf6, #ec4899)',
        ...style,
      }}
    >
      {picture ? (
        <img
          src={picture}
          alt={name || 'Profile'}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onError={(e) => {
            // A broken image URL must not leave a blank circle.
            e.currentTarget.style.display = 'none';
          }}
        />
      ) : (
        <span
          className={cn('font-bold select-none', textClassName)}
          style={{ fontSize: Math.max(11, Math.round(size * 0.38)) }}
        >
          {initialsOf(name)}
        </span>
      )}
    </div>
  );
}
