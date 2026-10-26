import { useState, useEffect, useRef } from 'react';
import { useModalA11y } from '../hooks/useModalA11y';
import { X, ZoomIn, ZoomOut, Play, Image as ImageIcon, Video as VideoIcon, Mic, AlertTriangle, RotateCcw } from 'lucide-react';

/**
 * The media attached to a complaint.
 *
 * It opens **in place** — an inline panel under the complaint, not a popup
 * window — so the reader never loses their place in the list.
 *
 * While a file loads, a proper placeholder is shown instead of a broken
 * frame, and a failed load is reported plainly.
 */
export default function MediaViewer({ media, onClose }) {
  const [zoom, setZoom] = useState(1);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [errorText, setErrorText] = useState('');

  // Fullscreen viewer — lock the page behind it, close on Escape.
  useModalA11y(true, onClose);
  const retryKey = useRef(0);

  // Reset when the media changes.
  useEffect(() => {
    setZoom(1);
    setStatus('loading');
    setErrorText('');
  }, [media?.url]);

  if (!media) return null;

  const isPhoto = media.type === 'photo';
  const isVideo = media.type === 'video';
  const isAudio = media.type === 'audio';

  const onError = () => {
    setStatus('error');
    setErrorText(
      'This file could not be loaded. It may have been removed, or the link may have expired.',
    );
  };

  const retry = () => {
    retryKey.current += 1;
    setStatus('loading');
    setErrorText('');
  };

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        className="modal-sheet"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: isAudio ? '520px' : '900px',
          maxHeight: '92vh',
          backgroundColor: 'var(--card-bg)',
          borderRadius: '18px',
          border: '1px solid var(--border-color)',
          boxShadow: '0 24px 70px rgba(0,0,0,0.45)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            padding: '0.85rem 1.1rem',
            borderBottom: '1px solid var(--border-color)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', minWidth: 0 }}>
            {isPhoto && <ImageIcon size={17} color="var(--primary-blue)" />}
            {isVideo && <VideoIcon size={17} color="var(--primary-blue)" />}
            {isAudio && <Mic size={17} color="var(--primary-blue)" />}
            <span
              style={{
                fontWeight: '700',
                fontSize: '0.9rem',
                color: 'var(--text-dark)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {isPhoto ? 'Photo' : isVideo ? 'Video' : 'Audio'} attachment
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            {isPhoto && status === 'ready' && (
              <>
                <button
                  onClick={() => setZoom((z) => Math.min(z + 0.5, 4))}
                  aria-label="Zoom in"
                  style={{
                    background: 'var(--bg-color)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-dark)',
                    borderRadius: '8px',
                    padding: '0.35rem',
                    cursor: 'pointer',
                    display: 'flex',
                  }}
                >
                  <ZoomIn size={16} />
                </button>
                <button
                  onClick={() => setZoom((z) => Math.max(z - 0.5, 1))}
                  aria-label="Zoom out"
                  style={{
                    background: 'var(--bg-color)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-dark)',
                    borderRadius: '8px',
                    padding: '0.35rem',
                    cursor: 'pointer',
                    display: 'flex',
                  }}
                >
                  <ZoomOut size={16} />
                </button>
                <span
                  style={{
                    fontSize: '0.78rem',
                    color: 'var(--text-light)',
                    fontWeight: '700',
                    minWidth: '38px',
                    textAlign: 'center',
                  }}
                >
                  {Math.round(zoom * 100)}%
                </span>
              </>
            )}
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                background: 'var(--bg-color)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-dark)',
                borderRadius: '50%',
                padding: '0.4rem',
                cursor: 'pointer',
                display: 'flex',
              }}
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div
          style={{
            padding: '1rem',
            overflow: 'auto',
            backgroundColor: isPhoto ? 'var(--bg-color)' : 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: isAudio ? 'auto' : '260px',
          }}
        >
          {status === 'error' ? (
            <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
              <AlertTriangle
                size={38}
                color="#d46b08"
                style={{ opacity: 0.7 }}
              />
              <p
                style={{
                  margin: '0.75rem 0 0',
                  color: 'var(--text-dark)',
                  fontWeight: '600',
                  fontSize: '0.92rem',
                }}
              >
                {errorText}
              </p>
              <button
                onClick={retry}
                style={{
                  marginTop: '0.9rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  background: 'var(--primary-blue)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '9px',
                  padding: '0.5rem 1rem',
                  fontWeight: '700',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                <RotateCcw size={15} /> Try again
              </button>
            </div>
          ) : isPhoto ? (
            <img
              key={retryKey.current}
              src={media.url}
              alt="Complaint attachment"
              onLoad={() => setStatus('ready')}
              onError={onError}
              style={{
                maxWidth: '100%',
                maxHeight: '72vh',
                objectFit: 'contain',
                transform: `scale(${zoom})`,
                transition: 'transform 0.2s ease-in-out',
                transformOrigin: 'center',
                borderRadius: '10px',
                opacity: status === 'ready' ? 1 : 0,
              }}
            />
          ) : isVideo ? (
            <video
              key={retryKey.current}
              src={media.url}
              controls
              autoPlay
              playsInline
              preload="metadata"
              onLoadedData={() => setStatus('ready')}
              onError={onError}
              style={{
                width: '100%',
                maxHeight: '72vh',
                borderRadius: '10px',
                background: '#000',
              }}
            />
          ) : (
            <div style={{ width: '100%' }}>
              <audio
                key={retryKey.current}
                src={media.url}
                controls
                autoPlay
                preload="metadata"
                onLoadedData={() => setStatus('ready')}
                onError={onError}
                style={{ width: '100%' }}
              />
            </div>
          )}

          {status === 'loading' && (
            <div
              style={{
                position: 'absolute',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.6rem',
                color: 'var(--text-light)',
                pointerEvents: 'none',
              }}
            >
              <div
                className="animate-pulse"
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '50%',
                  background: 'var(--bg-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {isAudio ? (
                  <Mic size={22} />
                ) : isVideo ? (
                  <VideoIcon size={22} />
                ) : (
                  <ImageIcon size={22} />
                )}
              </div>
              <span style={{ fontSize: '0.82rem', fontWeight: '600' }}>
                Loading attachment…
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
