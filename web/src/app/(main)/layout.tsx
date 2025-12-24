"use client";
import { ServerSidebar } from "@/components/layout/ServerSidebar";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import React, { useEffect } from "react";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading) return <div className="h-screen w-screen bg-dc-bg-primary flex items-center justify-center text-white">Loading...</div>;
  if (!user) return null;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-dc-bg-primary">
      {/* Server Sidebar */}
      <ServerSidebar />
      
      {/* Main Content (Channel List + Chat) */}
      <div className="flex-1 flex overflow-hidden">
        {children}
      </div>
    </div>
  );
}
