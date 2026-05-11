import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, UserPlus, Crown, LogOut, Trash2, UserMinus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import UserSearchSelect from "./UserSearchSelect";
import { useChatNotifications } from "@/contexts/ChatNotificationContext";

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
  const [confirmDeleteChat, setConfirmDeleteChat] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string } | null>(null);

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
        .from("public_profiles")
        .select("user_id, full_name, university, username")
        .in("user_id", userIds);
      return profiles || [];
    },
    enabled: open && !!chatroomId,
  });

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

  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase
        .from("chatroom_members")
        .delete()
        .eq("chatroom_id", chatroomId)
        .eq("user_id", memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chatroom-members", chatroomId] });
      toast({ title: "Member removed" });
      setRemoveTarget(null);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      setRemoveTarget(null);
    },
  });

  const deleteChatMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("chatrooms").delete().eq("id", chatroomId);
      if (error) throw error;
    },
    onSuccess: () => {
      // Close dialogs and bubble up so the parent can null selectedRoom,
      // which causes the realtime channel effect to clean up its subscription.
      setConfirmDeleteChat(false);
      onOpenChange(false);
      onLeft?.();
      // Clear stale per-room caches so no orphaned data lingers
      queryClient.removeQueries({ queryKey: ["messages", chatroomId] });
      queryClient.removeQueries({ queryKey: ["chatroom-members", chatroomId] });
      queryClient.invalidateQueries({ queryKey: ["chatrooms"] });
      toast({ title: "Chat deleted" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const isOwner = user?.id === createdBy;
  const memberIds = new Set(members.map((m: any) => m.user_id));
  const isMember = user ? memberIds.has(user.id) : false;

  return (
    <>
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
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{m.full_name || "Unknown"}</p>
                    {m.username && (
                      <p className="text-xs text-muted-foreground truncate">@{m.username}</p>
                    )}
                  </div>
                  {m.user_id === createdBy && <Crown className="h-4 w-4 text-primary" />}
                  {isOwner && m.user_id !== createdBy && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                      title="Remove from chat"
                      onClick={() => setRemoveTarget({ id: m.user_id, name: m.full_name || "this user" })}
                    >
                      <UserMinus className="h-4 w-4" />
                    </Button>
                  )}
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

        {isOwner && (
          <div className="border-t border-border pt-3">
            <Button
              variant="destructive"
              size="sm"
              className="w-full gap-2"
              onClick={() => setConfirmDeleteChat(true)}
              disabled={deleteChatMutation.isPending}
            >
              <Trash2 className="h-4 w-4" />
              Delete Chat
            </Button>
          </div>
        )}

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

    <AlertDialog open={confirmDeleteChat} onOpenChange={setConfirmDeleteChat}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this chat?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes the chat, all its messages, members, and pending invitations. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteChatMutation.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); deleteChatMutation.mutate(); }}
            disabled={deleteChatMutation.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteChatMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <AlertDialog open={!!removeTarget} onOpenChange={(o) => !o && setRemoveTarget(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {removeTarget?.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            They will lose access to this chat and its messages. You can re-invite them later.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={removeMemberMutation.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); if (removeTarget) removeMemberMutation.mutate(removeTarget.id); }}
            disabled={removeMemberMutation.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {removeMemberMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
