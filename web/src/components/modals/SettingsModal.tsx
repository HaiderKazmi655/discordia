"use client";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

export const SettingsModal = ({ onClose }: { onClose: () => void }) => {
    const { user, logout } = useAuth();
    const [activeTab, setActiveTab] = useState("my_account");
    const [displayName, setDisplayName] = useState(user?.displayName || "");
    const [avatarUrl, setAvatarUrl] = useState(user?.avatar || "");
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string>("");
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        if (!user) return;
        setSaving(true);
        let finalAvatar = avatarUrl || null;
        if (avatarFile) {
            const ext = avatarFile.name.split(".").pop()?.toLowerCase() || "png";
            const path = `${user.username}.${ext}`;
            const { error: upErr } = await supabase.storage.from("user-avatars").upload(path, avatarFile, {
                contentType: avatarFile.type || "image/png",
                upsert: true,
            });
            if (!upErr) {
                const { data: pub } = await supabase.storage.from("user-avatars").getPublicUrl(path);
                if (pub?.publicUrl) {
                    finalAvatar = pub.publicUrl;
                }
            } else {
                const dataUrl = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result as string);
                    reader.onerror = () => reject(new Error("read error"));
                    reader.readAsDataURL(avatarFile);
                });
                finalAvatar = dataUrl;
            }
        }
        const { error } = await supabase.from('users').upsert({
            username: user.username,
            displayName,
            avatar: finalAvatar
        }, { onConflict: 'username' });

        const usersMap = JSON.parse(localStorage.getItem("dc_users") || "{}");
        const existing = usersMap[user.username] || {};
        usersMap[user.username] = { ...existing, username: user.username, displayName, avatar: finalAvatar };
        localStorage.setItem("dc_users", JSON.stringify(usersMap));
        window.location.reload();
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex z-50">
            {/* Sidebar */}
            <div className="w-[30%] bg-[#2f3136] flex justify-end py-12 px-4">
                <div className="w-48 text-dc-text-muted text-sm font-medium">
                    <div className="px-2 pb-1.5 text-xs font-bold uppercase mb-2">User Settings</div>
                    <div 
                        onClick={() => setActiveTab("my_account")}
                        className={`px-2 py-1.5 rounded cursor-pointer mb-0.5 ${activeTab === 'my_account' ? 'bg-dc-bg-modifier text-white' : 'hover:bg-dc-bg-modifier hover:text-dc-text-normal'}`}
                    >
                        My Account
                    </div>
                    <div className="h-[1px] bg-dc-bg-modifier my-2 mx-2"></div>
                    <div 
                        onClick={logout}
                        className="px-2 py-1.5 rounded cursor-pointer hover:bg-dc-bg-modifier hover:text-red-400 text-red-400"
                    >
                        Log Out
                    </div>
                </div>
            </div>
            
            {/* Content */}
            <div className="flex-1 bg-white dark:bg-[#36393f] py-12 px-10 relative">
                <div className="max-w-2xl">
                    <h2 className="text-xl font-bold text-white mb-6">My Account</h2>
                    
                    {/* Profile Card */}
                    <div className="bg-[#202225] rounded-lg p-4 mb-8">
                        <div className="flex justify-between items-center mb-4">
                            <div className="flex items-center">
                                <div className="w-20 h-20 rounded-full bg-yellow-500 flex items-center justify-center text-white text-3xl mr-4 border-4 border-[#202225] -mt-2">
                                    {user?.avatar ? <img src={user.avatar} className="w-full h-full rounded-full object-cover"/> : (user?.displayName?.[0] || "?")}
                                </div>
                                <div>
                                    <div className="text-white text-xl font-bold">{user?.displayName}</div>
                                    <div className="text-dc-text-muted text-sm">UID: {user?.uid || "not set"}</div>
                                </div>
                            </div>
                            <button className="bg-dc-brand text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-indigo-600">
                                Edit User Profile
                            </button>
                        </div>
                        
                        <div className="bg-[#2f3136] rounded p-4 space-y-4">
                            <div className="flex justify-between items-center">
                                <div>
                                    <div className="text-xs font-bold text-dc-text-muted uppercase mb-1">Display Name</div>
                                    <div className="text-white">{displayName}</div>
                                </div>
                                <button onClick={() => setDisplayName(prompt("New Display Name:", displayName) || displayName)} className="bg-dc-bg-secondary px-3 py-1.5 rounded text-white text-sm hover:bg-dc-bg-tertiary">Edit</button>
                            </div>
                            <div className="flex justify-between items-center">
                                <div>
                                    <div className="text-xs font-bold text-dc-text-muted uppercase mb-1">UID</div>
                                    <div className="text-white">{user?.uid || "not set"}</div>
                                </div>
                                <button className="bg-dc-bg-secondary px-3 py-1.5 rounded text-white text-sm hover:bg-dc-bg-tertiary opacity-50 cursor-not-allowed">Edit</button>
                            </div>
                            <div>
                                <div className="text-xs font-bold text-dc-text-muted uppercase mb-2">Profile Picture</div>
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="bg-dc-bg-secondary px-3 py-1.5 rounded text-white text-sm"
                                    onChange={(e) => {
                                        const f = e.target.files?.[0] || null;
                                        setAvatarFile(f);
                                        setAvatarPreview(f ? URL.createObjectURL(f) : "");
                                    }}
                                />
                                {(avatarPreview || avatarUrl) && (
                                    <div className="mt-3">
                                        <img src={avatarPreview || avatarUrl} className="w-20 h-20 rounded-full object-cover border border-dc-bg-modifier" />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    
                    <div className="h-[1px] bg-dc-bg-modifier my-8"></div>
                    
                    <div className="flex justify-end">
                        <button onClick={handleSave} disabled={saving} className="bg-green-600 text-white px-6 py-2 rounded font-bold hover:bg-green-700 transition-colors">
                            {saving ? "Saving..." : "Save Changes"}
                        </button>
                    </div>
                </div>
                
                {/* Close Button */}
                <div className="absolute top-12 right-12 flex flex-col items-center cursor-pointer group" onClick={onClose}>
                    <div className="w-9 h-9 rounded-full border-2 border-dc-text-muted flex items-center justify-center text-dc-text-muted group-hover:border-white group-hover:text-white transition-colors">
                        ✕
                    </div>
                    <div className="text-xs font-bold text-dc-text-muted mt-1 group-hover:text-white uppercase">Esc</div>
                </div>
            </div>
        </div>
    );
};
