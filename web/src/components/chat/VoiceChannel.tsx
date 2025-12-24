"use client";
import { useAuth } from "@/context/AuthContext";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

export const VoiceChannel = ({ channelId, channelName }: { channelId: string; channelName: string }) => {
    const { user } = useAuth();
    const [joined, setJoined] = useState(false);
    const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
    const pcMap = useRef<Record<string, RTCPeerConnection>>({});
    const localStreamRef = useRef<MediaStream | null>(null);
    const screenStreamRef = useRef<MediaStream | null>(null);
    const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
    const [muted, setMuted] = useState(false);

    const addTracks = (pc: RTCPeerConnection) => {
        const ls = localStreamRef.current;
        const ss = screenStreamRef.current;
        if (ls) ls.getTracks().forEach(t => pc.addTrack(t, ls));
        if (ss) ss.getTracks().forEach(t => pc.addTrack(t, ss));
    };
    const createPC = (peer: string) => {
        const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
        pc.ontrack = (e) => {
            setRemoteStreams(prev => ({ ...prev, [peer]: e.streams[0] }));
        };
        pc.onicecandidate = (e) => {
            if (e.candidate) {
                channelRef.current?.send({ type: "broadcast", event: "ice", payload: { from: user?.username, to: peer, candidate: e.candidate } });
            }
        };
        pcMap.current[peer] = pc;
        addTracks(pc);
        return pc;
    };
    const makeOffer = async (peer: string) => {
        const pc = createPC(peer);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        channelRef.current?.send({ type: "broadcast", event: "offer", payload: { from: user?.username, to: peer, sdp: offer } });
    };
    const handleOffer = async (payload: any) => {
        const { from, to, sdp } = payload;
        if (to !== user?.username) return;
        const pc = createPC(from);
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        channelRef.current?.send({ type: "broadcast", event: "answer", payload: { from: user?.username, to: from, sdp: answer } });
    };
    const handleAnswer = async (payload: any) => {
        const { from, to, sdp } = payload;
        if (to !== user?.username) return;
        const pc = pcMap.current[from];
        if (!pc) return;
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    };
    const handleIce = async (payload: any) => {
        const { from, to, candidate } = payload;
        if (to !== user?.username) return;
        const pc = pcMap.current[from];
        if (!pc) return;
        try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
    };

    useEffect(() => {
        return () => {
            Object.values(pcMap.current).forEach(pc => pc.close());
            pcMap.current = {};
            localStreamRef.current?.getTracks().forEach(t => t.stop());
            screenStreamRef.current?.getTracks().forEach(t => t.stop());
            if (channelRef.current) supabase.removeChannel(channelRef.current);
        };
    }, []);

    const join = async () => {
        const ls = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        localStreamRef.current = ls;
        const ch = supabase.channel(`rtc:${channelId}`);
        channelRef.current = ch;
        ch.on("broadcast", { event: "join" }, (payload) => {
            const other = payload.payload.from;
            if (!other || other === user?.username) return;
            if ((user?.username || "") < other) makeOffer(other);
        });
        ch.on("broadcast", { event: "offer" }, (p) => handleOffer(p.payload));
        ch.on("broadcast", { event: "answer" }, (p) => handleAnswer(p.payload));
        ch.on("broadcast", { event: "ice" }, (p) => handleIce(p.payload));
        await ch.subscribe();
        ch.send({ type: "broadcast", event: "join", payload: { from: user?.username } });
        setJoined(true);
    };
    const leave = () => {
        Object.values(pcMap.current).forEach(pc => pc.close());
        pcMap.current = {};
        setRemoteStreams({});
        localStreamRef.current?.getTracks().forEach(t => t.stop());
        localStreamRef.current = null;
        screenStreamRef.current?.getTracks().forEach(t => t.stop());
        screenStreamRef.current = null;
        if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
            channelRef.current = null;
        }
        setJoined(false);
    };
    const toggleMute = () => {
        setMuted(m => {
            const next = !m;
            localStreamRef.current?.getAudioTracks().forEach(t => t.enabled = !next);
            return next;
        });
    };
    const shareScreen = async () => {
        const ss = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        screenStreamRef.current = ss;
        Object.values(pcMap.current).forEach(pc => {
            ss.getTracks().forEach(t => pc.addTrack(t, ss));
        });
    };

    return (
        <div className="flex-1 bg-black flex flex-col items-center justify-center p-4 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-gray-900 to-black z-0"></div>
            <div className="z-10 flex flex-col items-center">
                <div className="text-gray-400 mb-2 font-bold uppercase tracking-widest text-sm">Voice Channel</div>
                <h1 className="text-4xl text-white font-bold mb-8 flex items-center">
                    <span className="text-3xl mr-3 text-gray-400">🔊</span>
                    {channelName}
                </h1>
                {!joined ? (
                    <div className="bg-[#2f3136] p-8 rounded-lg shadow-2xl flex flex-col items-center max-w-md text-center">
                        <div className="w-24 h-24 bg-dc-bg-tertiary rounded-full mb-6 flex items-center justify-center">
                            <span className="text-4xl">👋</span>
                        </div>
                        <h3 className="text-white text-xl font-bold mb-2">Ready to join?</h3>
                        <p className="text-dc-text-muted mb-6">Connect to voice to talk with friends in this server.</p>
                        <button onClick={join} className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-full font-bold transition-all transform hover:scale-105">Join Voice</button>
                    </div>
                ) : (
                    <div className="w-full max-w-4xl">
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
                            <div className="bg-[#202225] p-4 rounded-lg flex flex-col items-center border-2 border-green-500 relative">
                                <div className="w-20 h-20 rounded-full bg-yellow-500 flex items-center justify-center text-white text-2xl mb-3">
                                    {user?.displayName?.[0] || "Me"}
                                </div>
                                <div className="text-white font-bold">{user?.displayName}</div>
                                <div className="absolute bottom-2 right-2 w-4 h-4 bg-green-500 rounded-full border-2 border-[#202225]"></div>
                            </div>
                            {Object.entries(remoteStreams).length === 0 && (
                                <div className="bg-[#2f3136] p-4 rounded-lg flex flex-col items-center opacity-50 border-2 border-dashed border-gray-600">
                                    <div className="w-20 h-20 rounded-full bg-dc-bg-tertiary flex items-center justify-center text-gray-500 text-2xl mb-3">?</div>
                                    <div className="text-gray-400 font-bold">Waiting for others...</div>
                                </div>
                            )}
                            {Object.entries(remoteStreams).map(([peer, stream]) => (
                                <div key={peer} className="bg-[#202225] p-4 rounded-lg flex flex-col items-center relative">
                                    <video
                                        autoPlay
                                        playsInline
                                        muted={false}
                                        ref={(el) => {
                                            if (el) el.srcObject = stream;
                                        }}
                                        className="w-32 h-32 rounded-lg object-cover bg-black"
                                    />
                                    <div className="text-white font-bold mt-2">{peer}</div>
                                </div>
                            ))}
                        </div>
                        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-[#2f3136] px-6 py-4 rounded-full shadow-2xl flex items-center space-x-6 z-50">
                            <button onClick={toggleMute} className={`p-4 ${muted ? "bg-dc-bg-secondary text-white" : "bg-white text-black"} rounded-full`}>🎙️</button>
                            <button onClick={shareScreen} className="p-4 bg-dc-bg-secondary text-white rounded-full">🖥️</button>
                            <button onClick={leave} className="p-4 bg-red-500 text-white rounded-full">📞</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
