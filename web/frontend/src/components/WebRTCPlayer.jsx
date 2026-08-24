import React, { useState } from 'react';

export default function WebRTCPlayer({ busId, cloudIp = 'localhost' }) {
  const [loading, setLoading] = useState(true);

  // Switch to MediaMTX's HLS player (port 8888) instead of WebRTC (8889)
  // HLS is 100% immune to Windows Defender UDP/ICE blocking issues.
  const playerUrl = `http://${cloudIp}:8888/live/${busId}/?autoplay=true&muted=true`;

  return (
    <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden border border-slate-700 shadow-lg">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center text-white z-10 bg-black/50">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        </div>
      )}
      <iframe
        src={playerUrl}
        className="w-full h-full border-0 absolute inset-0"
        allow="autoplay; fullscreen"
        onLoad={() => setLoading(false)}
        title={`Live feed for ${busId}`}
      />
      <div className="absolute top-2 right-2 bg-black/80 px-2 py-1 rounded text-xs text-white flex items-center gap-2 z-20 pointer-events-none">
        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
        {busId}
      </div>
    </div>
  );
}
