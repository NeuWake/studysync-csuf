import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Users, Trash2, GripVertical } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

interface StickyNote {
  id: string;
  content: string;
  color: string;
  author: string;
}

const noteColors = [
  "bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700",
  "bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700",
  "bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700",
  "bg-pink-100 dark:bg-pink-900/30 border-pink-300 dark:border-pink-700",
  "bg-purple-100 dark:bg-purple-900/30 border-purple-300 dark:border-purple-700",
];

const mockNotes: StickyNote[] = [
  { id: "1", content: "Key formula: F = ma\nRemember units!", color: noteColors[0], author: "You" },
  { id: "2", content: "Chapter 12 summary points:\n- Topic A\n- Topic B\n- Topic C", color: noteColors[1], author: "Alex R." },
  { id: "3", content: "Group meeting: Thursday 3 PM\nBring laptops", color: noteColors[2], author: "Jamie C." },
  { id: "4", content: "TODO: Review slides 45-60 before quiz", color: noteColors[3], author: "You" },
];

const mockBoards = [
  { id: "1", name: "PHYS 201 Study Session", members: 3, maxMembers: 5, course: "PHYS 201" },
  { id: "2", name: "CS 301 Final Review", members: 5, maxMembers: 5, course: "CS 301" },
  { id: "3", name: "General Brainstorm", members: 2, maxMembers: 5, course: null },
];

export default function WhiteboardPage() {
  const [selectedBoard, setSelectedBoard] = useState("1");
  const [notes, setNotes] = useState<StickyNote[]>(mockNotes);
  const [newNote, setNewNote] = useState("");

  const addNote = () => {
    if (!newNote.trim()) return;
    setNotes([...notes, {
      id: Date.now().toString(),
      content: newNote,
      color: noteColors[Math.floor(Math.random() * noteColors.length)],
      author: "You",
    }]);
    setNewNote("");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Whiteboard</h1>
          <p className="text-muted-foreground mt-1">Collaborate with shared notes in real-time</p>
        </div>
        <Button className="gap-2"><Plus className="h-4 w-4" /> New Board</Button>
      </div>

      {/* Board selector */}
      <div className="flex gap-3 overflow-x-auto pb-2">
        {mockBoards.map((board) => (
          <button
            key={board.id}
            onClick={() => setSelectedBoard(board.id)}
            className={`flex-shrink-0 p-3 rounded-lg border transition-colors ${
              selectedBoard === board.id ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50"
            }`}
          >
            <p className="text-sm font-medium text-foreground">{board.name}</p>
            <div className="flex items-center gap-2 mt-1">
              <Users className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{board.members}/{board.maxMembers}</span>
              {board.course && <Badge variant="outline" className="text-[10px]">{board.course}</Badge>}
            </div>
          </button>
        ))}
      </div>

      {/* Notes board */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Shared Notes</CardTitle>
            <Badge variant="secondary">
              <Users className="h-3 w-3 mr-1" />
              {mockBoards.find(b => b.id === selectedBoard)?.members} online
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
            {notes.map((note) => (
              <div key={note.id} className={`p-4 rounded-lg border-2 ${note.color} relative group`}>
                <div className="flex items-start justify-between mb-2">
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                <p className="text-sm text-foreground whitespace-pre-line">{note.content}</p>
                <p className="text-xs text-muted-foreground mt-3">{note.author}</p>
              </div>
            ))}
          </div>

          {/* Add note */}
          <div className="flex gap-2">
            <Textarea
              placeholder="Add a note..."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              className="flex-1"
              rows={2}
            />
            <Button onClick={addNote} className="self-end">Add Note</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
