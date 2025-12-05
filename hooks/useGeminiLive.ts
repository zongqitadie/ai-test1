import { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';

interface UseGeminiLiveProps {
  onAiMessage: (text: string) => void;
}

export const useGeminiLive = ({ onAiMessage }: UseGeminiLiveProps) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const apiKey = process.env.API_KEY;
  const audioContextRef = useRef<AudioContext | null>(null);
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  // Audio queue for smooth playback
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const connect = async () => {
    if (!apiKey) {
      console.warn("No API Key found for Live API");
      return;
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      
      // Setup Audio Contexts
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const inputCtx = new AudioContextClass({ sampleRate: 16000 });
      const outputCtx = new AudioContextClass({ sampleRate: 24000 });
      audioContextRef.current = outputCtx;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            console.log("Gemini Live Connected");
            setIsConnected(true);
            
            // Setup Input Stream
            const source = inputCtx.createMediaStreamSource(stream);
            inputSourceRef.current = source;
            
            const processor = inputCtx.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;
            
            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              // Simple downsampling/encoding to PCM
              const pcmData = convertFloat32ToInt16(inputData);
              const base64Data = arrayBufferToBase64(pcmData.buffer);

              if (sessionPromiseRef.current) {
                 sessionPromiseRef.current.then(session => {
                    session.sendRealtimeInput({
                      media: {
                        mimeType: 'audio/pcm;rate=16000',
                        data: base64Data
                      }
                    });
                 });
              }
            };

            source.connect(processor);
            processor.connect(inputCtx.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
            const serverContent = msg.serverContent;
            
            // Handle Audio Output
            if (serverContent?.modelTurn?.parts?.[0]?.inlineData) {
              const audioData = serverContent.modelTurn.parts[0].inlineData.data;
              if (audioData) {
                 await playAudioChunk(audioData, outputCtx);
              }
            }

            // Handle Text/Transcript if needed (using turnComplete usually)
            if (serverContent?.turnComplete) {
              setIsSpeaking(false);
            } else if (serverContent?.modelTurn) {
              setIsSpeaking(true);
            }
          },
          onclose: () => {
            setIsConnected(false);
            setIsSpeaking(false);
          },
          onerror: (err) => {
            console.error("Gemini Live Error", err);
            setIsConnected(false);
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: "You are the tactical AI for 'Neon Garden'. Speak like a futuristic military computer. Keep responses under 10 words. React to the battle. If user says 'Start', encourage them.",
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
          }
        }
      });

      sessionPromiseRef.current = sessionPromise;

    } catch (e) {
      console.error("Failed to connect to Live API", e);
    }
  };

  const playAudioChunk = async (base64Audio: string, ctx: AudioContext) => {
    try {
      const binaryString = atob(base64Audio);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const int16Data = new Int16Array(bytes.buffer);
      const float32Data = new Float32Array(int16Data.length);
      for (let i = 0; i < int16Data.length; i++) {
        float32Data[i] = int16Data[i] / 32768.0;
      }
      
      const buffer = ctx.createBuffer(1, float32Data.length, 24000);
      buffer.copyToChannel(float32Data, 0);

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      
      const currentTime = ctx.currentTime;
      const startTime = Math.max(currentTime, nextStartTimeRef.current);
      
      source.start(startTime);
      nextStartTimeRef.current = startTime + buffer.duration;
      
      sourcesRef.current.add(source);
      source.onended = () => sourcesRef.current.delete(source);
      
    } catch (e) {
      console.error("Audio Decode Error", e);
    }
  };

  const disconnect = () => {
    if (processorRef.current) processorRef.current.disconnect();
    if (inputSourceRef.current) inputSourceRef.current.disconnect();
    // Cannot explicitly close session easily in this SDK version without reference, 
    // but disconnecting audio nodes stops input.
    // In a full app, we'd manage the session object more strictly.
    setIsConnected(false);
  };

  return { connect, disconnect, isConnected, isSpeaking };
};

// Helpers
function convertFloat32ToInt16(buffer: Float32Array) {
  let l = buffer.length;
  let buf = new Int16Array(l);
  while (l--) {
    buf[l] = Math.min(1, Math.max(-1, buffer[l])) * 0x7FFF;
  }
  return buf;
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
