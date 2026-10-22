import { useMemo } from 'react';
import { Bus, ClipboardList, ArrowLeft } from 'lucide-react';

/**
 * The bus directory that staff see before they work through complaints.
 *
 * It is shared by the Community page and the Admin Dashboard so both offer
 * the same flow: pick a bus, then work through that bus's complaints.
 *
 * @param {Array}    busList    one entry per bus, from GET /api/routes
 * @param {Object}   busCounts  bus number -> { unresolved, awaiting, total }
 * @param {string}   selected   the selected bus number, or 'all'
 * @param {Function} onSelect   called with the bus number (or 'all')
 */
export default function BusPicker({
  busList = [],
  busCounts = {},
  selected = 'all',
  onSelect,
}) {
  const totals = useMemo(
    () => ({
      buses: busList.length,
      unresolved: busList.reduce((s, b) => s + (busCounts[b.busNumber]?.unresolved || 0), 0),
      awaiting: busList.reduce((s, b) => s + (busCounts[b.busNumber]?.awaiting || 0), 0),
      total: busList.reduce((s, b) => s + (busCounts[b.busNumber]?.total || 0), 0),
    }),
    [busList, busCounts],
  );

  if (selected !== 'all') {
    const bus = busList.find((b) => b.busNumber === selected);
    if (!bus) return null;
    const counts = busCounts[bus.busNumber] || {
      unresolved: 0,
      awaiting: 0,
      total: 0,
    };

    return (
      <section
        className="glass"
        style={{
          borderRadius: '18px',
          padding: '1.25rem',
          border: '1px solid var(--border-color)',
          boxShadow: '0 2px 10px rgba(16,24,40,0.05)',
          marginBottom: '1rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.85rem',
            flexWrap: 'wrap',
            marginBottom: '0.9rem',
          }}
        >
          <span
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '13px',
              background: 'var(--primary-blue)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Bus size={22} />
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p
              style={{
                margin: 0,
                fontSize: '1.1rem',
                fontWeight: '800',
                color: 'var(--text-dark)',
                letterSpacing: '-0.3px',
              }}
            >
              {bus.busNumber}
            </p>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-light)' }}>
              {bus.routeName}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <span
              title="Not yet resolved — new, in progress, or reopened"
              style={{
                fontSize: '0.72rem',
                fontWeight: '800',
                padding: '0.25rem 0.6rem',
                borderRadius: '7px',
                background: counts.unresolved > 0 ? '#cf1322' : '#e9ecef',
                color: counts.unresolved > 0 ? 'white' : '#666',
              }}
            >
              {counts.unresolved} unresolved
            </span>
            {counts.awaiting > 0 && (
              <span
                title="Marked as fixed — waiting for the complainant to confirm"
                style={{
                  fontSize: '0.72rem',
                  fontWeight: '800',
                  padding: '0.25rem 0.6rem',
                  borderRadius: '7px',
                  background: '#0958d9',
                  color: 'white',
                }}
              >
                {counts.awaiting} awaiting
              </span>
            )}
            <span
              title="Every complaint ever raised against this bus"
              style={{
                fontSize: '0.72rem',
                fontWeight: '700',
                padding: '0.25rem 0.6rem',
                borderRadius: '7px',
                background: '#e9ecef',
                color: '#666',
              }}
            >
              {counts.total} all time
            </span>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '0.45rem 1rem',
            fontSize: '0.76rem',
            color: 'var(--text-light)',
            borderTop: '1px solid var(--border-color)',
            paddingTop: '0.85rem',
          }}
        >
          <span>
            <strong style={{ color: 'var(--text-dark)' }}>Route ID:</strong>{' '}
            {bus.routeId}
          </span>
          <span>
            <strong style={{ color: 'var(--text-dark)' }}>Registration:</strong>{' '}
            {bus.registrationNumber}
          </span>
          <span>
            <strong style={{ color: 'var(--text-dark)' }}>Model:</strong>{' '}
            {bus.vehicleModel}
          </span>
          <span>
            <strong style={{ color: 'var(--text-dark)' }}>Capacity:</strong>{' '}
            {bus.capacity}
          </span>
          <span>
            <strong style={{ color: 'var(--text-dark)' }}>City:</strong>{' '}
            {bus.city}
          </span>
          <span>
            <strong style={{ color: 'var(--text-dark)' }}>Driver:</strong>{' '}
            {bus.driverId}
          </span>
        </div>
      </section>
    );
  }

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap',
          marginBottom: '1rem',
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: '1.3rem',
              fontWeight: '800',
              color: 'var(--text-dark)',
              letterSpacing: '-0.3px',
            }}
          >
            Complaints by bus
          </h2>
          <p
            style={{
              margin: '0.3rem 0 0',
              fontSize: '0.88rem',
              color: 'var(--text-light)',
            }}
          >
            {totals.buses} buses · {totals.unresolved} unresolved ·{' '}
            {totals.awaiting} awaiting confirmation · {totals.total} total
          </p>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '1rem',
        }}
      >
        {busList.map((b) => {
          const counts = busCounts[b.busNumber] || {
            unresolved: 0,
            awaiting: 0,
            total: 0,
          };
          return (
            <button
              key={b.busNumber}
              onClick={() => onSelect?.(b.busNumber)}
              className="glass"
              style={{
                borderRadius: '18px',
                padding: '1.25rem',
                textAlign: 'left',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.9rem',
                border: '1px solid var(--border-color)',
                boxShadow: '0 2px 10px rgba(16,24,40,0.05)',
                transition: 'transform 0.15s, box-shadow 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-3px)';
                e.currentTarget.style.boxShadow =
                  '0 10px 26px rgba(16,24,40,0.10)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow =
                  '0 2px 10px rgba(16,24,40,0.05)';
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.85rem',
                  minWidth: 0,
                }}
              >
                <span
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '14px',
                    background: 'var(--primary-blue)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Bus size={24} />
                </span>
                <div style={{ minWidth: 0 }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: '1.15rem',
                      fontWeight: '800',
                      color: 'var(--text-dark)',
                      letterSpacing: '-0.3px',
                    }}
                  >
                    {b.busNumber}
                  </p>
                  <p
                    style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-light)' }}
                  >
                    {b.routeName}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                <span
                  title="Not yet resolved — new, in progress, or reopened"
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: '800',
                    padding: '0.25rem 0.6rem',
                    borderRadius: '7px',
                    background: counts.unresolved > 0 ? '#cf1322' : '#e9ecef',
                    color: counts.unresolved > 0 ? 'white' : '#666',
                  }}
                >
                  {counts.unresolved} unresolved
                </span>
                {counts.awaiting > 0 && (
                  <span
                    title="Marked as fixed — waiting for the complainant to confirm"
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: '800',
                      padding: '0.25rem 0.6rem',
                      borderRadius: '7px',
                      background: '#0958d9',
                      color: 'white',
                    }}
                  >
                    {counts.awaiting} awaiting confirmation
                  </span>
                )}
                <span
                  title="Every complaint ever raised against this bus"
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: '700',
                    padding: '0.25rem 0.6rem',
                    borderRadius: '7px',
                    background: '#e9ecef',
                    color: '#666',
                  }}
                >
                  {counts.total} all time
                </span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: '0.45rem 0.85rem',
                  fontSize: '0.75rem',
                  color: 'var(--text-light)',
                  borderTop: '1px solid var(--border-color)',
                  paddingTop: '0.8rem',
                }}
              >
                <span>
                  <strong style={{ color: 'var(--text-dark)' }}>Route ID:</strong>{' '}
                  {b.routeId}
                </span>
                <span>
                  <strong style={{ color: 'var(--text-dark)' }}>Capacity:</strong>{' '}
                  {b.capacity}
                </span>
                <span>
                  <strong style={{ color: 'var(--text-dark)' }}>Registration:</strong>{' '}
                  {b.registrationNumber}
                </span>
                <span>
                  <strong style={{ color: 'var(--text-dark)' }}>City:</strong>{' '}
                  {b.city}
                </span>
                <span>
                  <strong style={{ color: 'var(--text-dark)' }}>Model:</strong>{' '}
                  {b.vehicleModel}
                </span>
                <span>
                  <strong style={{ color: 'var(--text-dark)' }}>Driver:</strong>{' '}
                  {b.driverId}
                </span>
              </div>

              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontSize: '0.82rem',
                  fontWeight: '700',
                  color: 'var(--primary-blue)',
                }}
              >
                <ClipboardList size={15} />
                Open this bus
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}
