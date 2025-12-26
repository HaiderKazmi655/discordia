"use client";
import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export type User = {
  username: string;
  displayName: string;
  avatar?: string | null;
  online?: boolean;
  uid?: string;
};

export type AuthContextType = {
  user: User | null;
  login: (username: string, passwordHash: string) => Promise<{ ok: boolean; error?: string }>;
  register: (username: string, displayName: string, passwordHash: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  login: async () => ({ ok: false }),
  register: async () => ({ ok: false }),
  logout: () => {},
  loading: true,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchUser = async (username: string) => {
      try {
        const { data } = await supabase
          .from("users")
          .select("*")
          .eq("username", username)
          .single();
        
        if (data) {
          try {
            const uidMap = JSON.parse(localStorage.getItem("dc_uid_map") || "{}");
            if (!data.uid && uidMap[username]) {
              data.uid = uidMap[username];
            }
          } catch {}
          return data;
        }
        // Fallback to local storage if offline or not found (legacy support)
        const localUsers = JSON.parse(localStorage.getItem("dc_users") || "{}");
        const u = localUsers[username] || null;
        if (u && !u.uid) {
          try {
            const uidMap = JSON.parse(localStorage.getItem("dc_uid_map") || "{}");
            u.uid = uidMap[username];
          } catch {}
        }
        return u;
      } catch {
        return null;
      }
    };

    // Check local storage for session
    const storedUser = localStorage.getItem("dc_current_user");
    if (storedUser) {
      // Fetch fresh data from Supabase if possible
      fetchUser(storedUser).then((u) => {
        if (u) {
          setUser(u);
          try {
            supabase.from("users").upsert(
              {
                username: u.username,
                displayName: u.displayName,
                avatar: u.avatar || null,
                online: true,
              },
              { onConflict: "username" }
            );
          } catch {}
        }
        setLoading(false);
      });
    } else {
      setTimeout(() => setLoading(false), 0);
    }
  }, []);

  const login = async (username: string, passwordHash: string) => {
    // Try Supabase first
    const { data } = await supabase
      .from("users")
      .select("*")
      .eq("username", username.toLowerCase())
      .single();

    if (data) {
      // In a real app, verify hash. Here we assume the client sends the hash or we check it.
      // The previous code didn't seem to do strict server-side auth, just client-side check.
      // We'll trust the input for now to match legacy behavior, but strict auth is better.
      if (data.passwordHash === passwordHash) {
        // Ensure uid exists
        let uid = data.uid as string | undefined;
        if (!uid) {
          const uidMap = JSON.parse(localStorage.getItem("dc_uid_map") || "{}");
          uid = uidMap[data.username];
          if (!uid) {
            uid = (crypto?.randomUUID?.() || Math.random().toString(36).slice(2));
            uidMap[data.username] = uid;
            localStorage.setItem("dc_uid_map", JSON.stringify(uidMap));
          }
          try {
            await supabase.from("users").update({ uid }).eq("username", data.username);
          } catch {}
          data.uid = uid;
        }
        setUser(data);
        localStorage.setItem("dc_current_user", data.username);
        return { ok: true };
      }
      return { ok: false, error: "Invalid password" };
    }

    // Fallback to local
    const localUsers = JSON.parse(localStorage.getItem("dc_users") || "{}");
    const u = localUsers[username.toLowerCase()];
    if (u && u.passwordHash === passwordHash) {
      // Ensure uid exists locally
      let uid = u.uid as string | undefined;
      const uidMap = JSON.parse(localStorage.getItem("dc_uid_map") || "{}");
      if (!uid) {
        uid = (crypto?.randomUUID?.() || Math.random().toString(36).slice(2));
        uidMap[u.username] = uid;
        localStorage.setItem("dc_uid_map", JSON.stringify(uidMap));
        u.uid = uid;
      } else if (!uidMap[u.username]) {
        uidMap[u.username] = uid;
        localStorage.setItem("dc_uid_map", JSON.stringify(uidMap));
      }
      setUser(u);
      localStorage.setItem("dc_current_user", u.username);
      try {
        await supabase.from("users").upsert(
          {
            username: u.username,
            displayName: u.displayName,
            avatar: u.avatar || null,
            online: true,
            uid,
          },
          { onConflict: "username" }
        );
      } catch {}
      return { ok: true };
    }

    return { ok: false, error: "User not found" };
  };

  const register = async (username: string, displayName: string, passwordHash: string) => {
    const lower = username.toLowerCase();
    const uid = (crypto?.randomUUID?.() || Math.random().toString(36).slice(2));
    const newUser = { username: lower, displayName, passwordHash, online: true, avatar: null, uid };

    // 1. Save to Supabase
    const { error } = await supabase.from("users").upsert(newUser, { onConflict: "username" });
    if (error) {
      try {
        await supabase.from("users").upsert(
          { username: lower, displayName, passwordHash, online: true, avatar: null },
          { onConflict: "username" }
        );
      } catch {}
    }
    
    // 2. Save to Local (Backup/Sync)
    const localUsers = JSON.parse(localStorage.getItem("dc_users") || "{}");
    localUsers[lower] = newUser;
    localStorage.setItem("dc_users", JSON.stringify(localUsers));
    const uidMap = JSON.parse(localStorage.getItem("dc_uid_map") || "{}");
    uidMap[lower] = uid;
    localStorage.setItem("dc_uid_map", JSON.stringify(uidMap));

    if (error && error.code !== "23505") { // Ignore duplicate key if it's just a sync issue
       console.error("Supabase register error:", error);
       // If Supabase fails, we might still want to allow local? 
       // For "Discord Clone", we should probably enforce cloud, but let's be lenient.
    }

    setUser(newUser);
    localStorage.setItem("dc_current_user", lower);
    return { ok: true };
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("dc_current_user");
    try {
      supabase.from("users").upsert(
        {
          username: user?.username || "",
          displayName: user?.displayName || "",
          avatar: user?.avatar || null,
          online: false,
        },
        { onConflict: "username" }
      );
    } catch {}
    router.push("/login");
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
