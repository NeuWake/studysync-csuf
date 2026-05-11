import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Check, X, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface ChatInvitationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ChatInvitationsDialog({ open, onOpenChange }: ChatInvitationsDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: invitations = [], isLoading } = useQuery({
    queryKey: ["chat-invitations", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("chatroom_invitations")
        .select("*")
        .eq("invited_user_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (!data?.length) return [];

      // Fetch chatroom names and inviter profiles
      const chatroomIds = [...new Set(data.map((i) => i.chatroom_id))];
      const inviterIds = [...new Set(data.map((i) => i.invited_by))];

      const [{ data: chatrooms }, { data: profiles }] = await Promise.all([
        supabase.from("chatrooms").select("id, name, type").in("id", chatroomIds),
        supabase.from("public_profiles").select("user_id, full_name").in("user_id", inviterIds),
      ]);

      const chatroomMap = new Map(chatrooms?.map((c) => [c.id, c]) || []);
      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);

      return data.map((inv) => ({
        ...inv,
        chatroom: chatroomMap.get(inv.chatroom_id),
        inviter: profileMap.get(inv.invited_by),
      }));
    },
    enabled: !!user,
  });

  const respondMutation = useMutation({
    mutationFn: async ({ invitationId, accept, chatroomId }: { invitationId: string; accept: boolean; chatroomId: string }) => {
      if (!user) throw new Error("Not authenticated");

      // Update invitation status
      const { error: updateErr } = await supabase
        .from("chatroom_invitations")
        .update({ status: accept ? "accepted" : "declined" })
        .eq("id", invitationId);
      if (updateErr) throw updateErr;

      // If accepted, add as member
      if (accept) {
        const { error: memberErr } = await supabase
          .from("chatroom_members")
          .insert({ chatroom_id: chatroomId, user_id: user.id });
        if (memberErr) throw memberErr;
      }
    },
    onSuccess: (_, { accept }) => {
      queryClient.invalidateQueries({ queryKey: ["chat-invitations"] });
      queryClient.invalidateQueries({ queryKey: ["chatrooms"] });
      toast({ title: accept ? "Joined the group!" : "Invitation declined" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> Group Invitations
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-80">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : invitations.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No pending invitations</p>
          ) : (
            <div className="space-y-3">
              {invitations.map((inv: any) => (
                <div key={inv.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      <Users className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {inv.chatroom?.name || "Unnamed Group"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Invited by {inv.inviter?.full_name || "Unknown"}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                      onClick={() => respondMutation.mutate({ invitationId: inv.id, accept: true, chatroomId: inv.chatroom_id })}
                      disabled={respondMutation.isPending}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
                      onClick={() => respondMutation.mutate({ invitationId: inv.id, accept: false, chatroomId: inv.chatroom_id })}
                      disabled={respondMutation.isPending}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
