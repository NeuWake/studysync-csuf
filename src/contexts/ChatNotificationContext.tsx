import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface ChatNotificationContextType {
  hasUnread: boolean;
  unreadRooms: Set<string>;
  markRoomRead: (roomId: string) => void;
  markAllRead: () => void;
  chimeMuted: boolean;
  toggleChimeMute: () => void;
  /** Broadcast that a chat was deleted so other tabs clear their unread state. */
  notifyChatDeleted: (roomId: string) => void;
}

const ChatNotificationContext = createContext<ChatNotificationContextType>({
  hasUnread: false,
  unreadRooms: new Set(),
  markRoomRead: () => {},
  markAllRead: () => {},
  chimeMuted: false,
  toggleChimeMute: () => {},
  notifyChatDeleted: () => {},
});

export const useChatNotifications = () => useContext(ChatNotificationContext);

// Generate a short chime sound using Web Audio API
function playChime() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
    setTimeout(() => ctx.close(), 500);
  } catch {
    // Audio not available, silently ignore
  }
}

export const ChatNotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [unreadRooms, setUnreadRooms] = useState<Set<string>>(new Set());
  const [chimeMuted, setChimeMuted] = useState(() => {
    return localStorage.getItem("studysync_chime_muted") === "true";
  });
  const currentPageChatRoomRef = useRef<string | null>(null);

  // Expose ref setter for ChatPage to report which room is active
  const markRoomRead = useCallback((roomId: string) => {
    currentPageChatRoomRef.current = roomId;
    setUnreadRooms((prev) => {
      if (!prev.has(roomId)) return prev;
      const next = new Set(prev);
      next.delete(roomId);
      return next;
    });
  }, []);

  const markAllRead = useCallback(() => {
    currentPageChatRoomRef.current = null;
    setUnreadRooms(new Set());
  }, []);

  const toggleChimeMute = useCallback(() => {
    setChimeMuted((prev) => {
      const next = !prev;
      localStorage.setItem("studysync_chime_muted", String(next));
      return next;
    });
  }, []);

  const queryClient = useQueryClient();
  const bcRef = useRef<BroadcastChannel | null>(null);

  // Cross-tab sync via BroadcastChannel
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const bc = new BroadcastChannel("studysync_chat");
    bcRef.current = bc;
    bc.onmessage = (ev) => {
      const data = ev.data;
      if (!data || typeof data !== "object") return;
      if (data.type === "chat_deleted" && typeof data.roomId === "string") {
        setUnreadRooms((prev) => {
          if (!prev.has(data.roomId)) return prev;
          const next = new Set(prev);
          next.delete(data.roomId);
          return next;
        });
        queryClient.invalidateQueries({ queryKey: ["chatrooms"] });
        queryClient.removeQueries({ queryKey: ["messages", data.roomId] });
        queryClient.removeQueries({ queryKey: ["chatroom-members", data.roomId] });
      }
    };
    return () => {
      bc.close();
      bcRef.current = null;
    };
  }, [queryClient]);

  const notifyChatDeleted = useCallback((roomId: string) => {
    // Local clear (in case caller forgot) + broadcast to other tabs
    setUnreadRooms((prev) => {
      if (!prev.has(roomId)) return prev;
      const next = new Set(prev);
      next.delete(roomId);
      return next;
    });
    bcRef.current?.postMessage({ type: "chat_deleted", roomId });
  }, []);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`global-chat-notif:${user.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "messages",
      }, (payload) => {
        const newMsg = payload.new as any;
        if (newMsg.user_id === user.id) return;
        if (newMsg.chatroom_id !== currentPageChatRoomRef.current) {
          setUnreadRooms((prev) => new Set(prev).add(newMsg.chatroom_id));

          // Play chime
          if (!chimeMuted) {
            playChime();
          }

          // Toast
          supabase
            .from("public_profiles")
            .select("full_name")
            .eq("user_id", newMsg.user_id)
            .maybeSingle()
            .then(({ data: profile }) => {
              const senderName = profile?.full_name || "Someone";
              toast({
                title: `New message from ${senderName}`,
                description: newMsg.content?.length > 50 ? newMsg.content.slice(0, 50) + "…" : newMsg.content,
              });
            });
        }
      })
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, [user, toast, chimeMuted]);

  return (
    <ChatNotificationContext.Provider
      value={{
        hasUnread: unreadRooms.size > 0,
        unreadRooms,
        markRoomRead,
        markAllRead,
        chimeMuted,
        toggleChimeMute,
        notifyChatDeleted,
      }}
    >
      {children}
    </ChatNotificationContext.Provider>
  );
};
