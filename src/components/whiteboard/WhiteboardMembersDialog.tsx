import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, UserMinus, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import UserSearchSelect from "@/components/chat/UserSearchSelect";

interface UserResult {
  user_id: string;
  full_name: string | null;
  university: string | null;
}

interface WhiteboardMembersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  whiteboardId: string;
  createdBy: string;
  onLeft?: () => void;
}

export default function WhiteboardMembersDialog({
  open,
  onOpenChange,
  whiteboardId,
  createdBy,
  onLeft,
}: WhiteboardMembersDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [usersToAdd, setUsersToAdd] = useState<UserResult[]>([]);
  const isOwner = user?.id === createdBy;

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["whiteboard-members", whiteboardId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whiteboard_members")
        .select("id, user_id, joined_at")
        .eq("whiteboard_id", whiteboardId);
      if (error) throw error;
      const userIds = (data || []).map((m) => m.user_id);
      if (!userIds.length) return [];
      const { data: profiles } = await supabase
        .from("public_profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);
      const profileMap = new Map(profiles?.map((p) => [p.user_id, p.full_name]) || []);
      return (data || []).map((m) => ({
        ...m,
        full_name: profileMap.get(m.user_id) || "Unknown",
      }));
    },
    enabled: open,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!usersToAdd.length) return;
      const rows = usersToAdd.map((u) => ({
        whiteboard_id: whiteboardId,
        user_id: u.user_id,
      }));
      const { error } = await supabase.from("whiteboard_members").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whiteboard-members", whiteboardId] });
      queryClient.invalidateQueries({ queryKey: ["whiteboards"] });
      setUsersToAdd([]);
      toast({ title: "Members added!" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const removeMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("whiteboard_members")
        .delete()
        .eq("whiteboard_id", whiteboardId)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whiteboard-members", whiteboardId] });
      queryClient.invalidateQueries({ queryKey: ["whiteboards"] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const handleLeave = async () => {
    if (!user) return;
    await removeMutation.mutateAsync(user.id);
    toast({ title: "You left the whiteboard" });
    onOpenChange(false);
    onLeft?.();
  };

  const existingIds = new Set(members.map((m: any) => m.user_id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Board Members</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-60">
          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-2">
              {members.map((m: any) => (
                <div key={m.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-secondary text-secondary-foreground text-xs">
                      {m.full_name?.[0]?.toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {m.full_name}{m.user_id === createdBy && " (Owner)"}
                    </p>
                  </div>
                  {isOwner && m.user_id !== user?.id && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => removeMutation.mutate(m.user_id)}
                      disabled={removeMutation.isPending}
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
          <div className="space-y-3 border-t border-border pt-3">
            <p className="text-sm font-medium text-foreground">Add Collaborators</p>
            <UserSearchSelect
              selectedUsers={usersToAdd.filter((u) => !existingIds.has(u.user_id))}
              onSelect={(u) => {
                if (existingIds.has(u.user_id)) {
                  toast({ title: "Already a member" });
                  return;
                }
                setUsersToAdd((prev) => [...prev, u]);
              }}
              onRemove={(id) => setUsersToAdd((prev) => prev.filter((u) => u.user_id !== id))}
            />
            <Button
              className="w-full"
              size="sm"
              onClick={() => addMutation.mutate()}
              disabled={addMutation.isPending || usersToAdd.length === 0}
            >
              {addMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Add {usersToAdd.length} Member{usersToAdd.length !== 1 ? "s" : ""}
            </Button>
          </div>
        )}

        {!isOwner && (
          <Button
            variant="destructive"
            size="sm"
            className="w-full mt-2"
            onClick={handleLeave}
            disabled={removeMutation.isPending}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Leave Board
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
