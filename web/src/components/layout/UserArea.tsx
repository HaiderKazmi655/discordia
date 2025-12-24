"use client";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { SettingsModal } from "@/components/modals/SettingsModal";

export const UserArea = () => {
    const { user } = useAuth();
    const [showSettings, setShowSettings] = useState(false);

    if (!user) return null;

    return (
        <>
            <div className="h-[52px] bg-dc-bg-tertiary flex items-center px-2 shrink-0">
                <div className="w-8 h-8 rounded-full bg-yellow-500 flex items-center justify-center text-white mr-2 shrink-0 cursor-pointer hover:opacity-80" onClick={() => setShowSettings(true)}>
                    {user.avatar ? <img src={user.avatar} className="w-full h-full rounded-full object-cover"/> : (user.displayName?.[0] || "?")}
                </div>
                <div className="flex-1 overflow-hidden mr-1">
                    <div className="text-sm font-bold text-white truncate cursor-pointer hover:underline" onClick={() => setShowSettings(true)}>{user.displayName}</div>
                    <div className="text-xs text-dc-text-muted truncate">#{user.username?.slice(0,4)}</div>
                </div>
                <div className="flex items-center">
                    <button className="p-1.5 hover:bg-dc-bg-modifier rounded text-dc-text-normal">🎙️</button>
                    <button className="p-1.5 hover:bg-dc-bg-modifier rounded text-dc-text-normal">🎧</button>
                    <button onClick={() => setShowSettings(true)} className="p-1.5 hover:bg-dc-bg-modifier rounded text-dc-text-normal">⚙️</button>
                </div>
            </div>
            {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
        </>
    );
};
