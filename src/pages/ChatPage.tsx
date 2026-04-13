import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, Plus, Users, Hash, Paperclip, Search } from "lucide-react";

interface ChatRoom {
  id: string;
  name: string;
  type: "dm" | "group" | "assignment_thread";
  lastMessage: string;
  time: string;
  unread: number;
  online?: boolean;
}

const mockRooms: ChatRoom[] = [
  { id: "1", name: "Alex Rivera", type: "dm", lastMessage: "Did you finish the lab report?", time: "2m", unread: 2, online: true },
  { id: "2", name: "CS 301 Study Group", type: "group", lastMessage: "Meeting at 3pm tomorrow", time: "15m", unread: 0 },
  { id: "3", name: "Final Project Thread", type: "assignment_thread", lastMessage: "I pushed the latest changes", time: "1h", unread: 5 },
  { id: "4", name: "Jamie Chen", type: "dm", lastMessage: "Thanks for the notes!", time: "3h", unread: 0, online: false },
  { id: "5", name: "MATH 250 Group", type: "group", lastMessage: "Anyone understand problem 4?", time: "5h", unread: 1 },
];

const mockMessages = [
  { id: 1, user: "Alex Rivera", content: "Hey, have you started the lab report?", time: "2:30 PM", isMe: false },
  { id: 2, user: "You", content: "Not yet, I was thinking of starting tonight", time: "2:32 PM", isMe: true },
  { id: 3, user: "Alex Rivera", content: "Cool, want to work on it together? I'm at the library", time: "2:33 PM", isMe: false },
  { id: 4, user: "You", content: "Sure! I'll be there in 30 minutes", time: "2:35 PM", isMe: true },
  { id: 5, user: "Alex Rivera", content: "Perfect, I'm on the 3rd floor near the windows", time: "2:35 PM", isMe: false },
  { id: 6, user: "Alex Rivera", content: "Did you finish the lab report?", time: "2:40 PM", isMe: false },
];

export default function ChatPage() {
  const [selectedRoom, setSelectedRoom] = useState<string>("1");
  const [message, setMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const selected = mockRooms.find((r) => r.id === selectedRoom);

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-4 animate-fade-in">
      {/* Sidebar */}
      <Card className="w-80 flex flex-col shrink-0">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Messages</CardTitle>
            <Button variant="ghost" size="icon"><Plus className="h-4 w-4" /></Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search chats..." className="pl-9" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
        </CardHeader>
        <ScrollArea className="flex-1">
          <div className="px-2 space-y-1">
            {mockRooms.map((room) => (
              <button
                key={room.id}
                onClick={() => setSelectedRoom(room.id)}
                className={`w-full text-left p-3 rounded-lg transition-colors ${
                  selectedRoom === room.id ? "bg-primary/10 border border-primary/20" : "hover:bg-muted/50"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="relative">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-secondary text-secondary-foreground text-xs">
                        {room.type === "dm" ? room.name.split(" ").map(n => n[0]).join("") : <Users className="h-4 w-4" />}
                      </AvatarFallback>
                    </Avatar>
                    {room.online !== undefined && (
                      <div className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card ${room.online ? "bg-success" : "bg-muted-foreground"}`} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-foreground truncate">{room.name}</p>
                      <span className="text-xs text-muted-foreground">{room.time}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground truncate">{room.lastMessage}</p>
                      {room.unread > 0 && (
                        <Badge className="h-5 w-5 flex items-center justify-center p-0 text-[10px]">{room.unread}</Badge>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </Card>

      {/* Chat area */}
      <Card className="flex-1 flex flex-col">
        <CardHeader className="border-b border-border pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-secondary text-secondary-foreground text-xs">AR</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-sm text-foreground">{selected?.name}</p>
                <p className="text-xs text-muted-foreground">
                  {selected?.type === "dm" ? (selected.online ? "Online" : "Offline") : "5 members"}
                </p>
              </div>
            </div>
          </div>
        </CardHeader>
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {mockMessages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.isMe ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[70%] p-3 rounded-xl ${
                  msg.isMe
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-muted text-foreground rounded-bl-sm"
                }`}>
                  {!msg.isMe && <p className="text-xs font-medium mb-1 opacity-70">{msg.user}</p>}
                  <p className="text-sm">{msg.content}</p>
                  <p className={`text-[10px] mt-1 ${msg.isMe ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{msg.time}</p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
        <div className="p-4 border-t border-border">
          <div className="flex gap-2">
            <Button variant="ghost" size="icon"><Paperclip className="h-4 w-4" /></Button>
            <Input
              placeholder="Type a message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="flex-1"
              onKeyDown={(e) => e.key === "Enter" && setMessage("")}
            />
            <Button size="icon"><Send className="h-4 w-4" /></Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
