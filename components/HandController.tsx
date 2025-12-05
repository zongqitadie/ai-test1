import React, { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import { Point } from '../types';

interface HandControllerProps {
  onHandMove: (point: Point) => void;
  onGesture?: (gesture: string) => void;
  debug?: boolean;
}

const HandController: React.FC<HandControllerProps> = ({ onHandMove, debug = false }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string>("");
  const lastVideoTimeRef = useRef<number>(-1);
  const requestRef = useRef<number>(0);
  const landmarkerRef = useRef<HandLandmarker | null>(null);

  useEffect(() => {
    let mounted = true;

    const setupHandLandmarker = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );
        
        if (!mounted) return;

        const landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 1
        });

        if (mounted) {
          landmarkerRef.current = landmarker;
          setIsLoaded(true);
        }
      } catch (e) {
        console.error("Failed to load MediaPipe", e);
        if (mounted) setError("Vision System Failure");
      }
    };

    setupHandLandmarker();

    return () => {
      mounted = false;
      if (landmarkerRef.current) {
        landmarkerRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    const enableCam = async () => {
      if (!isLoaded || !videoRef.current) return;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: 640, height: 480, frameRate: { ideal: 30 } } 
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.addEventListener('loadeddata', predictWebcam);
        }
      } catch (err) {
        setError("Camera Access Denied");
      }
    };

    if (isLoaded) {
      enableCam();
    }

    return () => {
      // Cleanup stream tracks
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded]);

  const predictWebcam = () => {
    if (!videoRef.current || !landmarkerRef.current) return;

    let startTimeMs = performance.now();
    
    if (lastVideoTimeRef.current !== videoRef.current.currentTime) {
      lastVideoTimeRef.current = videoRef.current.currentTime;
      
      const results = landmarkerRef.current.detectForVideo(videoRef.current, startTimeMs);
      
      if (results.landmarks && results.landmarks.length > 0) {
        // Get Index Finger Tip (Landmark 8)
        const indexTip = results.landmarks[0][8];
        // Flip X because webcam is mirrored
        onHandMove({ x: 1 - indexTip.x, y: indexTip.y });
      }
    }
    
    requestRef.current = requestAnimationFrame(predictWebcam);
  };

  return (
    <div className={`fixed bottom-4 left-4 z-50 border border-cyan-500/30 bg-black/80 rounded-lg overflow-hidden ${debug ? '' : 'opacity-80'}`}>
      {error && <div className="text-red-500 text-xs p-2">{error}</div>}
      {!isLoaded && !error && <div className="text-cyan-400 text-xs p-2 animate-pulse">Initializing Neural Link...</div>}
      <video 
        ref={videoRef} 
        className={`w-32 h-24 object-cover -scale-x-100 ${isLoaded ? 'block' : 'hidden'}`} 
        autoPlay 
        playsInline
        muted
      />
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none border border-cyan-500/50"></div>
      <div className="absolute bottom-1 right-1 text-[8px] text-cyan-500 font-mono">SYS.CAM.01</div>
    </div>
  );
};

export default HandController;
