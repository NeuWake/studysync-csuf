import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface UserResult {
  user_id: string;
  full_name: string | null;
  university: string | null;
  username?: string | null;
}

interface UserSearchSelectProps {
  selectedUsers: UserResult[];
  onSelect: (user: UserResult) => void;
  onRemove: (userId: string) => void;
}

export default function UserSearchSelect({ selectedUsers, onSelect, onRemove }: UserSearchSelectProps) {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserResult[]>([]);
  const [searching, setSearching] = useState(false);

  const handleSearch = async (q: string) => {
    setQuery(q);
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const { data } = await supabase
      .from("public_profiles")
      .select("user_id, full_name, university, username")
      .or(`full_name.ilike.%${q.trim()}%, username.ilike.%${q.trim()}%`)
      .neq("user_id", user?.id ?? "")
      .limit(10);
    setResults(data || []);
    setSearching(false);
  };

  const selectedIds = new Set(selectedUsers.map((u) => u.user_id));

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search users by name..."
          className="pl-9"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
        />
      </div>

      {selectedUsers.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedUsers.map((u) => (
            <Badge key={u.user_id} variant="secondary" className="gap-1 pr-1">
              {u.full_name || "Unknown"}
              <button onClick={() => onRemove(u.user_id)} className="ml-1 hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {query.trim().length >= 2 && (
        <ScrollArea className="max-h-40">
          {searching ? (
            <div className="flex justify-center py-3">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : results.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">No users found</p>
          ) : (
            <div className="space-y-1">
              {results
                .filter((r) => !selectedIds.has(r.user_id))
                .map((r) => (
                  <button
                    key={r.user_id}
                    onClick={() => {
                      onSelect(r);
                      setQuery("");
                      setResults([]);
                    }}
                    className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 text-left"
                  >
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="bg-secondary text-secondary-foreground text-xs">
                        {r.full_name?.[0]?.toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium text-foreground">{r.full_name || "Unknown"}</p>
                      {r.username && (
                        <p className="text-xs text-muted-foreground">@{r.username}</p>
                      )}
                      {r.university && <p className="text-xs text-muted-foreground">{r.university}</p>}
                    </div>
                  </button>
                ))}
            </div>
          )}
        </ScrollArea>
      )}
    </div>
  );
}
