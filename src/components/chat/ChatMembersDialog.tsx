import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, UserPlus, Crown, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import UserSearchSelect from "./UserSearchSelect";

interface ChatMembersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chatroomId: string;
  createdBy: string;
  onLeft?: () => void;
}

interface UserResult {
  user_id: string;
  full_name: string | null;
  university: string | null;
}

export default function ChatMembersDialog({ open, onOpenChange, chatroomId, createdBy, onLeft }: ChatMembersDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [usersToAdd, setUsersToAdd] = useState<UserResult[]>([]);

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["chatroom-members", chatroomId],
    queryFn: async () => {
      const { data: mems } = await supabase
        .from("chatroom_members")
        .select("user_id")
        .eq("chatroom_id", chatroomId);
      if (!mems?.length) return [];
      const userIds = mems.map((m) => m.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, university")
        .in("user_id", userIds);
      return profiles || [];
    },
    enabled: open && !!chatroomId,
  });

  // Send invitations instead of directly adding
  const inviteMutation = useMutation({
    mutationFn: async () => {
      if (!usersToAdd.length || !user) return;
      const inserts = usersToAdd.map((u) => ({
        chatroom_id: chatroomId,
        invited_by: user.id,
        invited_user_id: u.user_id,
      }));
      const { error } = await supabase.from("chatroom_invitations").insert(inserts);
      if (error) throw error;
    },
    onSuccess: () => {
      setUsersToAdd([]);
      toast({ title: "Invitations sent!" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  // Leave group
  const leaveMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("chatroom_members")
        .delete()
        .eq("chatroom_id", chatroomId)
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chatrooms"] });
      queryClient.invalidateQueries({ queryKey: ["chatroom-members", chatroomId] });
      onOpenChange(false);
      onLeft?.();
      toast({ title: "You left the group" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const isOwner = user?.id === createdBy;
  const memberIds = new Set(members.map((m: any) => m.user_id));
  const isMember = user ? memberIds.has(user.id) : false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Chat Members</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-48">
          {isLoading ? (
            <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : (
            <div className="space-y-2">
              {members.map((m: any) => (
                <div key={m.user_id} className="flex items-center gap-2 p-2 rounded-md">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-secondary text-secondary-foreground text-xs">
                      {m.full_name?.[0]?.toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium text-foreground flex-1">{m.full_name || "Unknown"}</span>
                  {m.user_id === createdBy && <Crown className="h-4 w-4 text-primary" />}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {isOwner && (
          <div className="border-t border-border pt-3 space-y-3">
            <p className="text-sm font-medium text-foreground flex items-center gap-1">
              <UserPlus className="h-4 w-4" /> Invite Members
            </p>
            <UserSearchSelect
              selectedUsers={usersToAdd.filter((u) => !memberIds.has(u.user_id))}
              onSelect={(u) => {
                if (!memberIds.has(u.user_id)) setUsersToAdd((prev) => [...prev, u]);
              }}
              onRemove={(id) => setUsersToAdd((prev) => prev.filter((u) => u.user_id !== id))}
            />
            {usersToAdd.length > 0 && (
              <Button
                size="sm"
                className="w-full"
                onClick={() => inviteMutation.mutate()}
                disabled={inviteMutation.isPending}
              >
                {inviteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Send {usersToAdd.length} invitation{usersToAdd.length > 1 ? "s" : ""}
              </Button>
            )}
          </div>
        )}

        {/* Leave Group - shown for all members except the creator */}
        {isMember && !isOwner && (
          <div className="border-t border-border pt-3">
            <Button
              variant="destructive"
              size="sm"
              className="w-full gap-2"
              onClick={() => leaveMutation.mutate()}
              disabled={leaveMutation.isPending}
            >
              {leaveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4" />
              )}
              Leave Group
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
