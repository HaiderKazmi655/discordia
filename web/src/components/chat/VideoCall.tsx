"use client";
import { useEffect, useRef, useState } from "react";
import Peer from "peerjs";
import { useAuth } from "@/context/AuthContext";

export const VideoCall = ({ friendUsername }: { friendUsername: string }) => {
    const { user } = useAuth();
    const [peer, setPeer] = useState<Peer | null>(null);
    const [call, setCall] = useState<any>(null);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [isCalling, setIsCalling] = useState(false);
    
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);

    // Initialize Peer
    useEffect(() => {
        if (!user) return;
        // Clean username for ID
        const myId = `dc-clone-${user.username.replace(/[^a-zA-Z0-9]/g, '')}`;
        const p = new Peer(myId);
        
        p.on('open', (id) => {
            console.log('My peer ID is: ' + id);
        });
        
        p.on('call', (incomingCall) => {
            console.log('Incoming call from', incomingCall.peer);
            if (confirm(`Incoming call from ${incomingCall.peer}. Answer?`)) {
                 navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((stream) => {
                    setLocalStream(stream);
                    if(localVideoRef.current) localVideoRef.current.srcObject = stream;
                    
                    incomingCall.answer(stream); // Answer the call with an A/V stream.
                    setCall(incomingCall);
                    
                    incomingCall.on('stream', (remoteStream: MediaStream) => {
                        setRemoteStream(remoteStream);
                        if(remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
                    });
                    
                    incomingCall.on('close', () => {
                        endCall();
                    });
                 });
            }
        });

        setPeer(p);
        
        return () => {
            p.destroy();
        };
    }, [user]);

    // Update refs when streams change
    useEffect(() => {
        if (localVideoRef.current && localStream) {
            localVideoRef.current.srcObject = localStream;
        }
    }, [localStream, call]); // Dependency on call to force re-render/ref update

    useEffect(() => {
        if (remoteVideoRef.current && remoteStream) {
            remoteVideoRef.current.srcObject = remoteStream;
        }
    }, [remoteStream, call]);

    const startCall = (video: boolean = true) => {
        if (!peer || !user) return;
        setIsCalling(true);
        
        navigator.mediaDevices.getUserMedia({ video: video, audio: true }).then((stream) => {
            setLocalStream(stream);
            
            const friendId = `dc-clone-${friendUsername.replace(/[^a-zA-Z0-9]/g, '')}`;
            console.log("Calling", friendId);
            const outgoingCall = peer.call(friendId, stream);
            setCall(outgoingCall);
            
            outgoingCall.on('stream', (remoteStream: MediaStream) => {
                setRemoteStream(remoteStream);
            });
            
            outgoingCall.on('close', () => {
                endCall();
            });
        }).catch(err => {
            console.error('Failed to get local stream', err);
            setIsCalling(false);
            alert("Could not access camera/microphone.");
        });
    };
    
    const startScreenShare = () => {
        if (!peer || !user) return;
        setIsCalling(true);
        navigator.mediaDevices.getDisplayMedia({ video: true, audio: true }).then((stream) => {
            setLocalStream(stream);
            const friendId = `dc-clone-${friendUsername.replace(/[^a-zA-Z0-9]/g, '')}`;
            const outgoingCall = peer.call(friendId, stream);
            setCall(outgoingCall);
            
             outgoingCall.on('stream', (remoteStream: MediaStream) => {
                setRemoteStream(remoteStream);
            });
             outgoingCall.on('close', () => endCall());
        });
    }

    const endCall = () => {
        call?.close();
        localStream?.getTracks().forEach(t => t.stop());
        setCall(null);
        setLocalStream(null);
        setRemoteStream(null);
        setIsCalling(false);
    };

    return (
        <div className="flex items-center space-x-2">
            {call ? (
                <button onClick={endCall} className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded">End Call</button>
            ) : (
                <div className="flex space-x-4">
                     <button onClick={() => startCall(true)} className="text-dc-text-muted hover:text-white" title="Video Call">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                     </button>
                     <button onClick={() => startCall(false)} className="text-dc-text-muted hover:text-white" title="Voice Call">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                     </button>
                     <button onClick={startScreenShare} className="text-dc-text-muted hover:text-white" title="Screen Share">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                     </button>
                </div>
            )}
            
            {/* Video Overlay */}
            {(localStream || remoteStream) && (
                <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center flex-col">
                    <div className="relative w-full max-w-5xl h-[80vh] bg-black rounded-lg overflow-hidden flex items-center justify-center">
                        {remoteStream ? (
                             <video ref={remoteVideoRef} autoPlay className="w-full h-full object-contain" />
                        ) : (
                             <div className="flex flex-col items-center animate-pulse">
                                 <div className="w-24 h-24 bg-dc-bg-secondary rounded-full flex items-center justify-center mb-4">
                                     <span className="text-4xl">📞</span>
                                 </div>
                                 <span className="text-white text-xl">Calling {friendUsername}...</span>
                             </div>
                        )}
                        <div className="absolute bottom-4 right-4 w-64 aspect-video bg-gray-900 rounded-lg overflow-hidden border border-white/20 shadow-lg">
                             <video ref={localVideoRef} autoPlay muted className="w-full h-full object-cover" />
                        </div>
                    </div>
                    <div className="mt-8 flex space-x-6">
                         <button className="bg-dc-bg-secondary p-4 rounded-full text-white hover:bg-dc-bg-tertiary">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                         </button>
                        <button onClick={endCall} className="bg-red-500 px-8 py-3 rounded-full text-white font-bold hover:bg-red-600 shadow-lg flex items-center">
                            <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6.616l-.388-.388" /></svg>
                            End Call
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
