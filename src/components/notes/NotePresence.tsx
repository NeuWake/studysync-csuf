import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Peer {
  user_id: string;
  name: string;
  avatar_url: string | null;
  color: string;
}

const PALETTE = [
  "hsl(var(--primary))",
  "hsl(var(--secondary))",
  "hsl(var(--accent))",
  "#10b981",
  "#ec4899",
  "#8b5cf6",
  "#f59e0b",
];

const colorFor = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
};

interface NotePresenceProps {
  noteId: string;
  pingRef: React.MutableRefObject<(() => void) | null>;
}

export function NotePresence({ noteId, pingRef }: NotePresenceProps) {
  const { user } = useAuth();
  const [peers, setPeers] = useState<Peer[]>([]);
  const [typing, setTyping] = useState<Map<string, { name: string; until: number }>>(new Map());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const meRef = useRef<Peer | null>(null);
  const lastPingRef = useRef(0);
  const sweepRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!user || !noteId) return;
    let cancelled = false;

    (async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, username, avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;

      const me: Peer = {
        user_id: user.id,
        name: profile?.full_name || profile?.username || user.email || "You",
        avatar_url: profile?.avatar_url ?? null,
        color: colorFor(user.id),
      };
      meRef.current = me;

      const ch = supabase.channel(`note-presence:${noteId}`, {
        config: { presence: { key: user.id } },
      });
      channelRef.current = ch;

      ch.on("presence", { event: "sync" }, () => {
        const state = ch.presenceState() as Record<string, Peer[]>;
        const list: Peer[] = [];
        Object.values(state).forEach((arr) => arr.forEach((p) => list.push(p)));
        // Deduplicate by user_id
        const seen = new Set<string>();
        const unique = list.filter((p) => (seen.has(p.user_id) ? false : seen.add(p.user_id)));
        setPeers(unique);
      });

      ch.on("broadcast", { event: "typing" }, ({ payload }) => {
        const p = payload as { user_id: string; name: string };
        if (p.user_id === user.id) return;
        setTyping((prev) => {
          const next = new Map(prev);
          next.set(p.user_id, { name: p.name, until: Date.now() + 2500 });
          return next;
        });
      });

      ch.subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await ch.track(me);
        }
      });

      // Sweep stale typing entries
      sweepRef.current = setInterval(() => {
        setTyping((prev) => {
          const now = Date.now();
          let changed = false;
          const next = new Map(prev);
          next.forEach((v, k) => {
            if (v.until < now) {
              next.delete(k);
              changed = true;
            }
          });
          return changed ? next : prev;
        });
      }, 1000);

      pingRef.current = () => {
        const now = Date.now();
        if (now - lastPingRef.current < 800) return;
        lastPingRef.current = now;
        ch.send({
          type: "broadcast",
          event: "typing",
          payload: { user_id: me.user_id, name: me.name },
        });
      };
    })();

    return () => {
      cancelled = true;
      pingRef.current = null;
      if (sweepRef.current) clearInterval(sweepRef.current);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setPeers([]);
      setTyping(new Map());
    };
  }, [noteId, user?.id, pingRef]);

  if (!user) return null;
  const others = peers.filter((p) => p.user_id !== user.id);
  const typingList = Array.from(typing.values()).map((t) => t.name);

  if (others.length === 0 && typingList.length === 0) return null;

  const typingText =
    typingList.length === 0
      ? null
      : typingList.length === 1
        ? `${typingList[0]} is typing…`
        : typingList.length === 2
          ? `${typingList[0]} and ${typingList[1]} are typing…`
          : `${typingList.length} people are typing…`;

  return (
    <div className="flex items-center gap-3 px-1 pb-2 text-xs text-muted-foreground">
      {others.length > 0 && (
        <TooltipProvider>
          <div className="flex -space-x-2">
            {others.slice(0, 5).map((p) => (
              <Tooltip key={p.user_id}>
                <TooltipTrigger asChild>
                  <Avatar
                    className="h-6 w-6 border-2 ring-0"
                    style={{ borderColor: p.color }}
                  >
                    {p.avatar_url && <AvatarImage src={p.avatar_url} alt={p.name} />}
                    <AvatarFallback
                      className="text-[10px] text-white"
                      style={{ backgroundColor: p.color }}
                    >
                      {p.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent>{p.name}</TooltipContent>
              </Tooltip>
            ))}
            {others.length > 5 && (
              <div className="h-6 w-6 rounded-full bg-muted border-2 border-background flex items-center justify-center text-[10px] font-medium">
                +{others.length - 5}
              </div>
            )}
          </div>
        </TooltipProvider>
      )}
      {typingText && (
        <div className="flex items-center gap-1.5">
          <span className="flex gap-0.5">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:0ms]" />
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:120ms]" />
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:240ms]" />
          </span>
          <span>{typingText}</span>
        </div>
      )}
    </div>
  );
}
