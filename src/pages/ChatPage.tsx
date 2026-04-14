import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Plus, Users, Search, Loader2, MessageSquare, UserPlus, ChevronUp, Bell, Paperclip, FileText, Image, Download, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { RealtimeChannel } from "@supabase/supabase-js";
import UserSearchSelect from "@/components/chat/UserSearchSelect";
import ChatMembersDialog from "@/components/chat/ChatMembersDialog";
import ChatInvitationsDialog from "@/components/chat/ChatInvitationsDialog";

interface Message {
  id: string;
  chatroom_id: string;
  user_id: string;
  content: string;
  sent_at: string;
  file_url?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  file_type?: string | null;
  profile?: { full_name: string | null } | null;
}

interface UserResult {
  user_id: string;
  full_name: string | null;
  university: string | null;
}

const MESSAGES_PER_PAGE = 15;

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
  const [membersOpen, setMembersOpen] = useState(false);
  const [invitationsOpen, setInvitationsOpen] = useState(false);
  const [inviteUsers, setInviteUsers] = useState<UserResult[]>([]);
  const [messageLimit, setMessageLimit] = useState(MESSAGES_PER_PAGE);
  const [hasMore, setHasMore] = useState(false);
  const [unreadRooms, setUnreadRooms] = useState<Set<string>>(new Set());
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const shouldScrollRef = useRef(true);
  const selectedRoomRef = useRef<string | null>(null);

  // Keep ref in sync with state so realtime callback sees latest value
  useEffect(() => {
    selectedRoomRef.current = selectedRoom;
  }, [selectedRoom]);

  // Reset limit and clear unread when switching rooms
  useEffect(() => {
    setMessageLimit(MESSAGES_PER_PAGE);
    shouldScrollRef.current = true;
    if (selectedRoom) {
      setUnreadRooms((prev) => {
        const next = new Set(prev);
        next.delete(selectedRoom);
        return next;
      });
    }
  }, [selectedRoom]);

  // Global realtime subscription for unread indicators + toast notifications
  useEffect(() => {
    if (!user) return;
    const globalChannel = supabase
      .channel(`global-messages:${user.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "messages",
      }, (payload) => {
        const newMsg = payload.new as any;
        // Skip own messages
        if (newMsg.user_id === user.id) return;
        // Mark as unread if not currently viewing that room
        if (newMsg.chatroom_id !== selectedRoomRef.current) {
          setUnreadRooms((prev) => new Set(prev).add(newMsg.chatroom_id));
          // Show toast notification
          supabase
            .from("profiles")
            .select("full_name")
            .eq("user_id", newMsg.user_id)
            .maybeSingle()
            .then(({ data: profile }) => {
              const senderName = profile?.full_name || "Someone";
              toast({
                title: `New message from ${senderName}`,
                description: newMsg.content.length > 50 ? newMsg.content.slice(0, 50) + "…" : newMsg.content,
              });
            });
        }
      })
      .subscribe();
    return () => { globalChannel.unsubscribe(); };
  }, [user, toast]);

  // Realtime subscription for invitation notifications
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`invitations:${user.id}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "chatroom_invitations",
        filter: `invited_user_id=eq.${user.id}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["chat-invitations-count"] });
        queryClient.invalidateQueries({ queryKey: ["chat-invitations"] });
      })
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, [user, queryClient]);

  // Fetch chatrooms
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

  // Fetch pending invitation count
  const { data: pendingInviteCount = 0 } = useQuery({
    queryKey: ["chat-invitations-count", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { count, error } = await supabase
        .from("chatroom_invitations")
        .select("*", { count: "exact", head: true })
        .eq("invited_user_id", user.id)
        .eq("status", "pending");
      if (error) return 0;
      return count || 0;
    },
    enabled: !!user,
  });

  // Fetch messages with limit
  const { data: messages = [], isLoading: msgsLoading } = useQuery({
    queryKey: ["messages", selectedRoom, messageLimit],
    queryFn: async () => {
      if (!selectedRoom) return [];
      // Fetch one extra to check if there are more
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("chatroom_id", selectedRoom)
        .order("sent_at", { ascending: false })
        .limit(messageLimit + 1);
      if (error) throw error;

      const hasMoreMessages = (data || []).length > messageLimit;
      setHasMore(hasMoreMessages);

      const sliced = hasMoreMessages ? (data || []).slice(0, messageLimit) : (data || []);
      // Reverse to chronological order
      const chronological = sliced.reverse();

      const userIds = [...new Set(chronological.map((m) => m.user_id))];
      if (!userIds.length) return chronological;
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);
      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);
      return chronological.map((m) => ({ ...m, profile: profileMap.get(m.user_id) || null }));
    },
    enabled: !!selectedRoom,
  });

  // Realtime
  useEffect(() => {
    if (!selectedRoom) return;
    channelRef.current = supabase
      .channel(`messages:${selectedRoom}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "messages",
        filter: `chatroom_id=eq.${selectedRoom}`,
      }, async (payload) => {
        const newMsg = payload.new as Message;
        const { data: profile } = await supabase
          .from("profiles").select("user_id, full_name")
          .eq("user_id", newMsg.user_id).maybeSingle();
        newMsg.profile = profile;
        shouldScrollRef.current = true;
        queryClient.setQueryData<Message[]>(["messages", selectedRoom, messageLimit], (old) => {
          if (!old) return [newMsg];
          if (old.some((m) => m.id === newMsg.id)) return old;
          return [...old, newMsg];
        });
      })
      .subscribe();
    return () => { channelRef.current?.unsubscribe(); };
  }, [selectedRoom, queryClient, messageLimit]);

  // Auto-scroll only when new messages arrive (not when loading older)
  useEffect(() => {
    if (shouldScrollRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const loadMore = useCallback(() => {
    shouldScrollRef.current = false;
    setMessageLimit((prev) => prev + MESSAGES_PER_PAGE);
  }, []);

  // File size limits
  const getMaxFileSize = () => {
    if (!selectedRoomData) return 50;
    return selectedRoomData.type === "group" ? 100 : 50;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const maxMB = getMaxFileSize();
    if (file.size > maxMB * 1024 * 1024) {
      toast({ title: "File too large", description: `Max file size is ${maxMB}MB for ${selectedRoomData?.type === "group" ? "group chats" : "DMs"}.`, variant: "destructive" });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setPendingFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Send message (with optional file)
  const sendMutation = useMutation({
    mutationFn: async ({ content, file }: { content: string; file?: File | null }) => {
      if (!user || !selectedRoom) throw new Error("Not ready");

      let fileUrl: string | null = null;
      let fileName: string | null = null;
      let fileSize: number | null = null;
      let fileType: string | null = null;

      if (file) {
        setUploading(true);
        const ext = file.name.split(".").pop() || "bin";
        const path = `${selectedRoom}/${user.id}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("chat-files")
          .upload(path, file);
        setUploading(false);
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage.from("chat-files").getPublicUrl(path);
        fileUrl = urlData.publicUrl;
        fileName = file.name;
        fileSize = file.size;
        fileType = file.type;
      }

      const msgContent = content || (fileName ? `📎 ${fileName}` : "");
      const { error } = await supabase.from("messages").insert({
        chatroom_id: selectedRoom,
        user_id: user.id,
        content: msgContent,
        file_url: fileUrl,
        file_name: fileName,
        file_size: fileSize,
        file_type: fileType,
      } as any);
      if (error) throw error;
    },
    onError: (err: any) => {
      setUploading(false);
      toast({ title: "Failed to send", description: err.message, variant: "destructive" });
    },
  });

  const handleSend = () => {
    const text = message.trim();
    if (!text && !pendingFile) return;
    setMessage("");
    const file = pendingFile;
    setPendingFile(null);
    shouldScrollRef.current = true;
    sendMutation.mutate({ content: text, file });
  };

  // Create chatroom with invitations (not direct add)
  const createRoomMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const name = newChatType === "dm" && inviteUsers.length === 1
        ? inviteUsers[0].full_name || "Direct Message"
        : newChatName.trim();
      if (!name) throw new Error("Please provide a chat name");

      const { data: room, error } = await supabase
        .from("chatrooms")
        .insert({ name, type: newChatType, created_by: user.id })
        .select("id")
        .single();
      if (error) throw error;

      // Add only the creator as a member
      const { error: memErr } = await supabase
        .from("chatroom_members")
        .insert({ chatroom_id: room.id, user_id: user.id });
      if (memErr) throw memErr;

      // Send invitations to selected users
      if (inviteUsers.length > 0) {
        const invitations = inviteUsers.map((u) => ({
          chatroom_id: room.id,
          invited_by: user.id,
          invited_user_id: u.user_id,
        }));
        const { error: invErr } = await supabase
          .from("chatroom_invitations")
          .insert(invitations);
        if (invErr) throw invErr;
      }

      return room;
    },
    onSuccess: (room) => {
      queryClient.invalidateQueries({ queryKey: ["chatrooms"] });
      setSelectedRoom(room.id);
      setNewChatName("");
      setInviteUsers([]);
      setDialogOpen(false);
      toast({ title: inviteUsers.length > 0 ? "Chat created! Invitations sent." : "Chat created!" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const selectedRoomData = rooms.find((r: any) => r.id === selectedRoom);
  const filteredRooms = rooms.filter((r: any) =>
    !searchQuery || r.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const canCreate = newChatType === "dm" ? inviteUsers.length === 1 : !!newChatName.trim();

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-4 animate-fade-in">
      {/* Sidebar */}
      <Card className="w-80 flex flex-col shrink-0">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Messages</CardTitle>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="relative" onClick={() => setInvitationsOpen(true)}>
                <Bell className="h-4 w-4" />
                {pendingInviteCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center">
                    {pendingInviteCount}
                  </span>
                )}
              </Button>
              <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setInviteUsers([]); setNewChatName(""); } }}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon"><Plus className="h-4 w-4" /></Button>
                </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>New Chat</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-2">
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
                  {newChatType === "group" && (
                    <div className="space-y-2">
                      <Label>Chat Name</Label>
                      <Input placeholder="e.g. CS 301 Study Group" value={newChatName} onChange={(e) => setNewChatName(e.target.value)} />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>{newChatType === "dm" ? "Select User" : "Invite Users (optional)"}</Label>
                    <UserSearchSelect
                      selectedUsers={inviteUsers}
                      onSelect={(u) => {
                        if (newChatType === "dm") {
                          setInviteUsers([u]);
                        } else {
                          setInviteUsers((prev) => [...prev, u]);
                        }
                      }}
                      onRemove={(id) => setInviteUsers((prev) => prev.filter((u) => u.user_id !== id))}
                    />
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => createRoomMutation.mutate()}
                    disabled={createRoomMutation.isPending || !canCreate}
                  >
                    {createRoomMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    {newChatType === "dm" ? "Start Conversation" : "Create Group"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            </div>
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
                    {unreadRooms.has(room.id) && (
                      <span className="mt-1 h-3 w-3 rounded-full bg-primary shrink-0 animate-pulse" />
                    )}
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
                <div className="flex-1">
                  <p className="font-medium text-sm text-foreground">{selectedRoomData?.name || "Chat"}</p>
                  <p className="text-xs text-muted-foreground capitalize">{selectedRoomData?.type?.replace("_", " ")}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setMembersOpen(true)}>
                  <UserPlus className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <div className="flex-1 overflow-auto p-4" ref={scrollRef}>
              {msgsLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : (
                <>
                  {hasMore && (
                    <div className="flex justify-center mb-4">
                      <Button variant="ghost" size="sm" onClick={loadMore} className="text-xs gap-1">
                        <ChevronUp className="h-3 w-3" />
                        Load older messages
                      </Button>
                    </div>
                  )}
                  {messages.length === 0 ? (
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
                              {msg.file_url && (
                                <div className="mb-1">
                                  {msg.file_type?.startsWith("image/") ? (
                                    <a href={msg.file_url} target="_blank" rel="noopener noreferrer">
                                      <img
                                        src={msg.file_url}
                                        alt={msg.file_name || "Image"}
                                        className="max-w-full max-h-48 rounded-lg object-cover"
                                        loading="lazy"
                                      />
                                    </a>
                                  ) : (
                                    <a
                                      href={msg.file_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className={`flex items-center gap-2 p-2 rounded-lg border ${
                                        isMe ? "border-primary-foreground/20 hover:bg-primary-foreground/10" : "border-border hover:bg-muted"
                                      }`}
                                    >
                                      <FileText className="h-5 w-5 shrink-0" />
                                      <div className="min-w-0 flex-1">
                                        <p className="text-xs font-medium truncate">{msg.file_name || "File"}</p>
                                        {msg.file_size && (
                                          <p className="text-[10px] opacity-70">
                                            {msg.file_size < 1024 * 1024
                                              ? `${(msg.file_size / 1024).toFixed(1)} KB`
                                              : `${(msg.file_size / (1024 * 1024)).toFixed(1)} MB`}
                                          </p>
                                        )}
                                      </div>
                                      <Download className="h-4 w-4 shrink-0 opacity-60" />
                                    </a>
                                  )}
                                </div>
                              )}
                              {msg.content && !(msg.file_url && msg.content.startsWith("📎")) && (
                                <p className="text-sm">{msg.content}</p>
                              )}
                              <p className={`text-[10px] mt-1 ${isMe ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                                {formatTime(msg.sent_at)}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
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
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
                  }}
                />
                <Button size="icon" onClick={handleSend} disabled={!message.trim() || sendMutation.isPending}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {selectedRoomData && (
              <ChatMembersDialog
                open={membersOpen}
                onOpenChange={setMembersOpen}
                chatroomId={selectedRoom}
                createdBy={selectedRoomData.created_by}
                onLeft={() => setSelectedRoom(null)}
              />
            )}
          </>
        )}
      </Card>

      <ChatInvitationsDialog
        open={invitationsOpen}
        onOpenChange={(o) => {
          setInvitationsOpen(o);
          if (!o) {
            queryClient.invalidateQueries({ queryKey: ["chat-invitations-count"] });
            queryClient.invalidateQueries({ queryKey: ["chatrooms"] });
          }
        }}
      />
    </div>
  );
}
