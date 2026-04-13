import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import { Camera, Save, Key, GraduationCap, BookOpen, Calendar, Star } from "lucide-react";

export default function ProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState({
    fullName: user?.user_metadata?.full_name || "Student Name",
    university: "State University",
    major: "Computer Science",
    gradYear: "2026",
    studyInterests: "AI/ML, Web Development, Data Science",
    canvasToken: "",
  });

  const handleSave = () => {
    // Will connect to Supabase
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Profile & Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account and preferences</p>
      </div>

      {/* Profile header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-6">
            <div className="relative">
              <Avatar className="h-20 w-20">
                <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                  {profile.fullName.split(" ").map(n => n[0]).join("")}
                </AvatarFallback>
              </Avatar>
              <Button size="icon" variant="outline" className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full">
                <Camera className="h-3 w-3" />
              </Button>
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">{profile.fullName}</h2>
              <p className="text-sm text-muted-foreground">{user?.email || "student@university.edu"}</p>
              <div className="flex gap-2 mt-2">
                <Badge variant="secondary"><GraduationCap className="h-3 w-3 mr-1" /> {profile.major}</Badge>
                <Badge variant="outline"><Calendar className="h-3 w-3 mr-1" /> Class of {profile.gradYear}</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">42</p>
            <p className="text-xs text-muted-foreground">Help Points</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-secondary">12</p>
            <p className="text-xs text-muted-foreground">Day Streak</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-success">87%</p>
            <p className="text-xs text-muted-foreground">Completion</p>
          </CardContent>
        </Card>
      </div>

      {/* Edit form */}
      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={profile.fullName} onChange={(e) => setProfile({ ...profile, fullName: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>University</Label>
              <Input value={profile.university} onChange={(e) => setProfile({ ...profile, university: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Major</Label>
              <Input value={profile.major} onChange={(e) => setProfile({ ...profile, major: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Graduation Year</Label>
              <Input value={profile.gradYear} onChange={(e) => setProfile({ ...profile, gradYear: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Study Interests</Label>
            <Textarea value={profile.studyInterests} onChange={(e) => setProfile({ ...profile, studyInterests: e.target.value })} />
          </div>
          <Button onClick={handleSave} className="gap-2"><Save className="h-4 w-4" /> Save Changes</Button>
        </CardContent>
      </Card>

      {/* Canvas integration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Key className="h-5 w-5" /> Canvas Integration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Enter your Canvas API access token to sync courses and assignments.</p>
          <div className="flex gap-2">
            <Input
              type="password"
              placeholder="Canvas access token"
              value={profile.canvasToken}
              onChange={(e) => setProfile({ ...profile, canvasToken: e.target.value })}
              className="flex-1"
            />
            <Button variant="outline">Validate & Save</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
