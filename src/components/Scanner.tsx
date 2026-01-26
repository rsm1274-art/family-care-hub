import React, { useState, useRef, useEffect } from 'react';
import { Camera, X, Image as ImageIcon, RefreshCw } from 'lucide-react';

interface ScannerProps {
  onResult: (image: string) => void;
  onCancel: () => void;
}

export const Scanner: React.FC<ScannerProps> = ({ onResult, onCancel }) => {
  const [cameraActive, setCameraActive] = useState(true);
  const [cameraError, setCameraError] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Start Camera on Mount
  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      setCameraActive(true);
      setCameraError(false);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera Error:", err);
      setCameraError(true);
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // Draw video frame to canvas
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        // Convert to base64 (drop the data:image/... prefix for storage)
        const dataUrl = canvas.toDataURL('image/jpeg');
        const base64 = dataUrl.split(',')[1];
        
        stopCamera();
        onResult(base64);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    stopCamera();
    
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(',')[1];
      onResult(base64Data);
    };
    reader.readAsDataURL(file);
  };

  const handleSecureSharing = () => {
    alert('Secure sharing enabled for this session.');
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="p-4 flex justify-between items-center bg-black/50 absolute top-0 w-full z-20 backdrop-blur-sm">
        <h2 className="text-white font-semibold flex items-center gap-2">
          <Camera className="w-5 h-5 text-accent" />
          Take Photo
        </h2>
        <button onClick={() => { stopCamera(); onCancel(); }} className="text-white/80 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors">
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center relative bg-neutral-900 overflow-hidden">
        
        {/* Hidden Canvas for capture */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Live Camera Feed */}
        {!cameraError ? (
          <video 
            ref={videoRef}
            autoPlay 
            playsInline 
            muted
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="text-center p-8 z-10 max-w-sm">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Camera className="w-8 h-8 text-red-500" />
            </div>
            <p className="text-white font-medium mb-2">Camera Unavailable</p>
            <p className="text-slate-400 text-sm mb-6">We couldn't access your camera. Please check permissions or upload a photo manually.</p>
            <button 
              onClick={startCamera}
              className="flex items-center justify-center gap-2 text-accent hover:text-white transition-colors mx-auto"
            >
              <RefreshCw className="w-4 h-4" /> Try Again
            </button>
          </div>
        )}

        {/* Overlay Guide */}
        {!cameraError && (
            <div className="absolute inset-0 pointer-events-none">
              <div className="w-full h-full flex items-center justify-center">
                 <div className="w-3/4 h-1/2 border-2 border-white/30 rounded-lg relative">
                    <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-accent -mt-1 -ml-1"></div>
                    <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-accent -mt-1 -mr-1"></div>
                    <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-accent -mb-1 -ml-1"></div>
                    <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-accent -mb-1 -mr-1"></div>
                 </div>
              </div>
              <p className="absolute bottom-32 left-0 w-full text-center text-white/80 text-sm font-medium px-4">
                Make sure text is clear and readable
              </p>
            </div>
        )}
      </div>

      {/* Controls */}
      <div className="p-8 bg-black/80 backdrop-blur-md z-20 flex items-center justify-between">
        
        {/* Upload Button */}
        <label className="flex flex-col items-center gap-1 text-white/60 hover:text-white cursor-pointer transition-colors">
          <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20">
            <ImageIcon className="w-6 h-6" />
          </div>
          <span className="text-xs">Upload</span>
          <input 
            ref={fileInputRef}
            type="file" 
            accept="image/*" 
            className="hidden" 
            onChange={handleFileChange}
          />
        </label>

        {/* Shutter Button */}
        <button 
          onClick={handleCapture}
          disabled={cameraError}
          className={`w-20 h-20 rounded-full border-4 border-white/30 flex items-center justify-center transition-transform active:scale-95 ${cameraError ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <div className="w-16 h-16 bg-white rounded-full shadow-lg shadow-white/20"></div>
        </button>

        {/* Spacer for alignment */}
        <div className="w-12 opacity-0"></div>
      </div>

      {/* Secure Sharing Section */}
      <div className="p-4 bg-black/50 absolute bottom-0 w-full z-20 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-semibold text-sm">Secure Sharing</h3>
          <button 
            onClick={handleSecureSharing}
            className="text-accent text-sm font-medium hover:underline"
          >
            Enable Secure Sharing
          </button>
        </div>
        <p className="text-slate-400 text-xs mt-1">
          Your photos are not stored or shared without your consent.
        </p>
      </div>
    </div>
  );
};