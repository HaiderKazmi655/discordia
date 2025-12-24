"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
        if (user) router.push("/channels/me");
        else router.push("/login");
    }
  }, [user, loading, router]);

  return <div className="h-screen w-screen bg-dc-bg-primary flex items-center justify-center text-white">Loading...</div>;
}
