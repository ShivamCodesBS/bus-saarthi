import { cn } from "../../lib/utils";

/**
 * Base skeleton element with pulse animation
 */
function SkeletonBase({ className, ...props }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded bg-muted",
        className
      )}
      {...props}
    />
  );
}

/**
 * Complaint card skeleton - matches the complaint card layout in Community.jsx
 */
export function ComplaintSkeleton({ className, ...props }) {
  return (
    <div
      className={cn(
        "glass p-glass animate-slide-up",
        "border-l-4 border-slate-300 dark:border-slate-600",
        className
      )}
      style={{
        borderRadius: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}
      {...props}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
          <SkeletonBase className="w-10 h-10 rounded-full" style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <SkeletonBase className="h-4 w-48" style={{ width: '120px', height: '14px', borderRadius: '4px' }} />
            <SkeletonBase className="h-3 w-32" style={{ width: '80px', height: '10px', borderRadius: '4px' }} />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', justifyContent: 'flex-end', flexShrink: 0 }}>
          <SkeletonBase className="h-5 w-20" style={{ fontSize: '0.65rem', fontWeight: '800', padding: '0.25rem 0.4rem', borderRadius: '6px', width: '80px', height: '20px' }} />
          <SkeletonBase className="h-5 w-24" style={{ fontSize: '0.7rem', fontWeight: 'bold', padding: '0.25rem 0.5rem', borderRadius: '8px', width: '96px', height: '24px' }} />
        </div>
      </div>

      {/* Content */}
      <SkeletonBase className="h-5 w-full" style={{ width: '100%', height: '14px', borderRadius: '4px', marginTop: '0.5rem' }} />
      <SkeletonBase className="h-5 w-3/4" style={{ width: '75%', height: '14px', borderRadius: '4px' }} />

      {/* Media Attachment placeholder */}
      <SkeletonBase className="h-48 w-full" style={{ width: '100%', height: '192px', borderRadius: '12px', marginTop: '0.5rem' }} />

      {/* Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f0f0f0', paddingTop: '1rem', marginTop: '0.5rem', gap: '0.75rem', flexWrap: 'wrap' }}>
        <SkeletonBase className="h-10 w-32" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', borderRadius: '30px', width: '128px', height: '40px' }} />
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <SkeletonBase className="h-9 w-24" style={{ padding: '0.4rem 1rem', borderRadius: '8px', width: '96px', height: '36px' }} />
          <SkeletonBase className="h-9 w-24" style={{ padding: '0.4rem 1rem', borderRadius: '8px', width: '96px', height: '36px' }} />
        </div>
      </div>
    </div>
  );
}

/**
 * My Complaints list item skeleton
 */
export function MyComplaintSkeleton({ className, ...props }) {
  return (
    <div
      className={cn("glass", className)}
      style={{
        borderRadius: '12px',
        padding: '0.75rem 0.85rem',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.75rem',
        border: '1px solid var(--border-color)',
        background: 'var(--bg-color)',
      }}
      {...props}
    >
      <SkeletonBase className="w-7 h-7 rounded" style={{ width: '30px', height: '30px', borderRadius: '9px' }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <SkeletonBase className="h-5 w-full" style={{ width: '100%', height: '14px', borderRadius: '4px', fontWeight: '600' }} />
        <SkeletonBase className="h-4 w-3/4" style={{ width: '75%', height: '10px', borderRadius: '4px', marginTop: '0.3rem' }} />
      </div>
      <SkeletonBase className="h-5 w-20" style={{ fontSize: '0.68rem', fontWeight: '800', padding: '0.2rem 0.5rem', borderRadius: '7px', width: '80px', height: '24px' }} />
    </div>
  );
}

/**
 * Route card skeleton (for AdminDashboard)
 */
export function RouteSkeleton({ className, ...props }) {
  return (
    <div
      className={cn("glass p-glass", className)}
      style={{
        borderRadius: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        padding: '1.5rem',
      }}
      {...props}
    >
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <SkeletonBase className="w-10 h-10 rounded-full" style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <SkeletonBase className="h-5 w-48" style={{ width: '120px', height: '14px', borderRadius: '4px' }} />
          <SkeletonBase className="h-3 w-32" style={{ width: '80px', height: '10px', borderRadius: '4px' }} />
        </div>
      </div>
      <SkeletonBase className="h-4 w-full" style={{ width: '100%', height: '14px', borderRadius: '4px', marginTop: '0.5rem' }} />
    </div>
  );
}

/**
 * User row skeleton (for AdminDashboard users table)
 */
export function UserRowSkeleton({ className, ...props }) {
  return (
    <div
      className={cn("glass p-glass", className)}
      style={{
        borderRadius: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        padding: '1rem',
      }}
      {...props}
    >
      <SkeletonBase className="w-10 h-10 rounded-full" style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <SkeletonBase className="h-5 w-40" style={{ width: '160px', height: '14px', borderRadius: '4px' }} />
        <SkeletonBase className="h-3 w-32" style={{ width: '80px', height: '10px', borderRadius: '4px' }} />
      </div>
      <SkeletonBase className="h-6 w-20" style={{ width: '80px', height: '24px', borderRadius: '6px' }} />
      <SkeletonBase className="h-8 w-20" style={{ width: '80px', height: '32px', borderRadius: '8px' }} />
      <SkeletonBase className="h-8 w-20" style={{ width: '80px', height: '32px', borderRadius: '8px' }} />
    </div>
  );
}

/**
 * Stats card skeleton
 */
export function StatCardSkeleton({ className, ...props }) {
  return (
    <div
      className={cn("glass p-6 rounded-2xl flex items-center gap-4", className)}
      {...props}
    >
      <SkeletonBase className="w-12 h-12 rounded-xl" style={{ width: '48px', height: '48px', borderRadius: '12px' }} />
      <div className="min-w-0">
        <SkeletonBase className="h-4 w-48" style={{ width: '192px', height: '16px', borderRadius: '4px' }} />
        <SkeletonBase className="h-8 w-24 mt-2" style={{ width: '96px', height: '32px', borderRadius: '4px', marginTop: '8px' }} />
      </div>
    </div>
  );
}

/**
 * Profile page skeleton - matches the identity card + details layout
 */
export function ProfileSkeleton({ className, ...props }) {
  return (
    <div className={cn("space-y-4", className)} {...props}>
      {/* Identity card skeleton */}
      <div className="glass p-glass animate-slide-up" style={{ borderRadius: '18px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.9rem', textAlign: 'center' }}>
        <SkeletonBase className="w-24 h-24 rounded-full" style={{ width: '96px', height: '96px', borderRadius: '50%' }} />
        <div style={{ width: '80%' }}>
          <SkeletonBase className="h-6 w-full" style={{ height: '24px', borderRadius: '4px' }} />
          <SkeletonBase className="h-4 w-3/4 mt-2" style={{ height: '16px', width: '75%', borderRadius: '4px', marginTop: '8px' }} />
        </div>
        <SkeletonBase className="h-8 w-48 mt-2" style={{ height: '32px', width: '192px', borderRadius: '9999px', marginTop: '8px' }} />
      </div>

      {/* Details sections skeleton */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="glass" style={{ borderRadius: '18px', padding: '1.25rem' }}>
            <SkeletonBase className="h-4 w-32 mb-4" style={{ height: '16px', width: '128px', borderRadius: '4px' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {[1, 2, 3].map((j) => (
                <div key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.7rem', padding: '0.6rem 0' }}>
                  <SkeletonBase className="w-8 h-8 rounded" style={{ width: '32px', height: '32px', borderRadius: '9px' }} />
                  <div style={{ minWidth: 0 }}>
                    <SkeletonBase className="h-3 w-20" style={{ height: '12px', width: '80px', borderRadius: '4px' }} />
                    <SkeletonBase className="h-5 w-40 mt-1" style={{ height: '20px', width: '160px', borderRadius: '4px', marginTop: '4px' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Attendance grid skeleton (7-day grid)
 */
export function AttendanceGridSkeleton({ className, ...props }) {
  return (
    <div className={cn("space-y-4", className)} {...props}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', marginBottom: '0.9rem' }}>
        <SkeletonBase className="h-10 w-24" style={{ fontSize: '1.9rem', fontWeight: '800', width: '96px', height: '40px', borderRadius: '4px' }} />
        <SkeletonBase className="h-5 w-40" style={{ fontSize: '0.82rem', width: '160px', height: '20px', borderRadius: '4px' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '0.4rem' }}>
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem', minWidth: 0 }}>
            <SkeletonBase className="h-3 w-full" style={{ fontSize: '0.68rem', width: '100%', height: '12px', borderRadius: '4px' }} />
            <SkeletonBase className="w-8 h-8 rounded-xl" style={{ width: '32px', height: '32px', borderRadius: '12px', aspectRatio: '1', maxWidth: '38px' }} />
            <SkeletonBase className="h-3 w-full" style={{ fontSize: '0.62rem', width: '100%', height: '12px', borderRadius: '4px' }} />
          </div>
        ))}
      </div>
      <SkeletonBase className="h-4 w-3/4 mt-4" style={{ fontSize: '0.76rem', width: '75%', height: '16px', borderRadius: '4px', marginTop: '16px' }} />
    </div>
  );
}

/**
 * Generic skeleton with customizable lines
 */
export function GenericSkeleton({ lines = 3, className, ...props }) {
  return (
    <div className={cn("space-y-3", className)} {...props}>
      {[...Array(lines)].map((_, i) => (
        <SkeletonBase
          key={i}
          className="h-4 w-full"
          style={{ width: i === lines - 1 ? '60%' : '100%', height: '14px', borderRadius: '4px' }}
        />
      ))}
    </div>
  );
}

/**
 * Loading overlay for full page/section
 */
export function LoadingOverlay({ className, children, isLoading, ...props }) {
  if (!isLoading) return <>{children}</>;
  
  return (
    <div
      className={cn("relative", className)}
      style={{ minHeight: '200px', ...props }}
    >
      <div style={{ position: 'absolute', inset: 0, zIndex: 10 }}>
        {[1, 2, 3].map((i) => (
          <ComplaintSkeleton key={i} style={{ opacity: 1 - i * 0.2 }} />
        ))}
      </div>
    </div>
  );
}