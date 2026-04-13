import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Plus, Users, Hash, Search, Loader2, MessageSquare } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface Message {
  id: string;
  chatroom_id: string;
  user_id: string;
  content: string;
  sent_at: string;
  profile?: { full_name: string | null } | null;
}

export default function ChatPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [newChatName, setNewChatName] = useState("");
  const [newChatType, setNewChatType] = useState<"dm" | "group">("group");
  const [dialogOpen, setDialogOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Fetch chatrooms the user is a member of
  const { data: rooms = [], isLoading: roomsLoading } = useQuery({
    queryKey: ["chatrooms", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data: memberships, error } = await supabase
        .from("chatroom_members")
        .select("chatroom_id")
        .eq("user_id", user.id);
      if (error) throw error;
      if (!memberships?.length) return [];

      const ids = memberships.map((m) => m.chatroom_id);
      const { data: chatrooms, error: crErr } = await supabase
        .from("chatrooms")
        .select("*")
        .in("id", ids)
        .order("created_at", { ascending: false });
      if (crErr) throw crErr;
      return chatrooms || [];
    },
    enabled: !!user,
  });

  // Fetch messages for selected room
  const { data: messages = [], isLoading: msgsLoading } = useQuery({
    queryKey: ["messages", selectedRoom],
    queryFn: async () => {
      if (!selectedRoom) return [];
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("chatroom_id", selectedRoom)
        .order("sent_at", { ascending: true })
        .limit(200);
      if (error) throw error;

      // Fetch profiles for message authors
      const userIds = [...new Set((data || []).map((m) => m.user_id))];
      if (!userIds.length) return data || [];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);

      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);
      return (data || []).map((m) => ({
        ...m,
        profile: profileMap.get(m.user_id) || null,
      }));
    },
    enabled: !!selectedRoom,
  });

  // Realtime subscription for messages
  useEffect(() => {
    if (!selectedRoom) return;

    channelRef.current = supabase
      .channel(`messages:${selectedRoom}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `chatroom_id=eq.${selectedRoom}`,
        },
        async (payload) => {
          const newMsg = payload.new as Message;
          // Fetch profile for the new message author
          const { data: profile } = await supabase
            .from("profiles")
            .select("user_id, full_name")
            .eq("user_id", newMsg.user_id)
            .maybeSingle();
          newMsg.profile = profile;

          queryClient.setQueryData<Message[]>(["messages", selectedRoom], (old) => {
            if (!old) return [newMsg];
            // Avoid duplicates
            if (old.some((m) => m.id === newMsg.id)) return old;
            return [...old, newMsg];
          });
        }
      )
      .subscribe();

    return () => {
      channelRef.current?.unsubscribe();
    };
  }, [selectedRoom, queryClient]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Send message
  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!user || !selectedRoom) throw new Error("Not ready");
      const { error } = await supabase.from("messages").insert({
        chatroom_id: selectedRoom,
        user_id: user.id,
        content,
      });
      if (error) throw error;
    },
    onError: (err: any) => {
      toast({ title: "Failed to send", description: err.message, variant: "destructive" });
    },
  });

  const handleSend = () => {
    const text = message.trim();
    if (!text) return;
    setMessage("");
    sendMutation.mutate(text);
  };

  // Create chatroom
  const createRoomMutation = useMutation({
    mutationFn: async () => {
      if (!user || !newChatName.trim()) throw new Error("Missing data");
      // Create chatroom
      const { data: room, error } = await supabase
        .from("chatrooms")
        .insert({
          name: newChatName.trim(),
          type: newChatType,
          created_by: user.id,
        })
        .select("id")
        .single();
      if (error) throw error;

      // Add creator as member
      const { error: memErr } = await supabase
        .from("chatroom_members")
        .insert({ chatroom_id: room.id, user_id: user.id });
      if (memErr) throw memErr;

      return room;
    },
    onSuccess: (room) => {
      queryClient.invalidateQueries({ queryKey: ["chatrooms"] });
      setSelectedRoom(room.id);
      setNewChatName("");
      setDialogOpen(false);
      toast({ title: "Chat created!" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const selectedRoomData = rooms.find((r: any) => r.id === selectedRoom);
  const filteredRooms = rooms.filter((r: any) =>
    !searchQuery || r.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-4 animate-fade-in">
      {/* Sidebar */}
      <Card className="w-80 flex flex-col shrink-0">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Messages</CardTitle>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon"><Plus className="h-4 w-4" /></Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>New Chat</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label>Chat Name</Label>
                    <Input
                      placeholder="e.g. CS 301 Study Group"
                      value={newChatName}
                      onChange={(e) => setNewChatName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={newChatType} onValueChange={(v) => setNewChatType(v as any)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dm">Direct Message</SelectItem>
                        <SelectItem value="group">Group Chat</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => createRoomMutation.mutate()}
                    disabled={createRoomMutation.isPending || !newChatName.trim()}
                  >
                    {createRoomMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Create Chat
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search chats..." className="pl-9" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
        </CardHeader>
        <ScrollArea className="flex-1">
          <div className="px-2 space-y-1">
            {roomsLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : filteredRooms.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No chats yet. Create one!</p>
            ) : (
              filteredRooms.map((room: any) => (
                <button
                  key={room.id}
                  onClick={() => setSelectedRoom(room.id)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    selectedRoom === room.id ? "bg-primary/10 border border-primary/20" : "hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-secondary text-secondary-foreground text-xs">
                        {room.type === "dm" ? (room.name?.[0] || "?") : <Users className="h-4 w-4" />}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{room.name || "Unnamed"}</p>
                      <p className="text-xs text-muted-foreground capitalize">{room.type.replace("_", " ")}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </Card>

      {/* Chat area */}
      <Card className="flex-1 flex flex-col">
        {!selectedRoom ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <MessageSquare className="h-12 w-12 mb-3 opacity-40" />
            <p className="text-lg font-medium">Select a chat</p>
            <p className="text-sm">or create a new one to start messaging</p>
          </div>
        ) : (
          <>
            <CardHeader className="border-b border-border pb-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-secondary text-secondary-foreground text-xs">
                    {selectedRoomData?.type === "dm" ? (selectedRoomData?.name?.[0] || "?") : <Users className="h-4 w-4" />}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-sm text-foreground">{selectedRoomData?.name || "Chat"}</p>
                  <p className="text-xs text-muted-foreground capitalize">{selectedRoomData?.type?.replace("_", " ")}</p>
                </div>
              </div>
            </CardHeader>
            <div className="flex-1 overflow-auto p-4" ref={scrollRef}>
              {msgsLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : messages.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No messages yet. Say hello!</p>
              ) : (
                <div className="space-y-4">
                  {messages.map((msg: Message) => {
                    const isMe = msg.user_id === user?.id;
                    return (
                      <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[70%] p-3 rounded-xl ${
                          isMe
                            ? "bg-primary text-primary-foreground rounded-br-sm"
                            : "bg-muted text-foreground rounded-bl-sm"
                        }`}>
                          {!isMe && (
                            <p className="text-xs font-medium mb-1 opacity-70">
                              {msg.profile?.full_name || "Unknown"}
                            </p>
                          )}
                          <p className="text-sm">{msg.content}</p>
                          <p className={`text-[10px] mt-1 ${isMe ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                            {formatTime(msg.sent_at)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-border">
              <div className="flex gap-2">
                <Input
                  placeholder="Type a message..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                />
                <Button size="icon" onClick={handleSend} disabled={!message.trim() || sendMutation.isPending}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
