import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Camera, Save, Key, GraduationCap, Calendar, Loader2 } from "lucide-react";

export default function ProfilePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [profile, setProfile] = useState({
    fullName: "",
    university: "",
    major: "",
    gradYear: "",
    studyInterests: "",
    canvasToken: "",
    canvasBaseUrl: "https://msmary.instructure.com",
    helpPoints: 0,
    studyStreaks: 0,
  });

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setProfile({
            fullName: data.full_name || "",
            university: data.university || "",
            major: data.major || "",
            gradYear: data.grad_year?.toString() || "",
            studyInterests: data.study_interests || "",
            canvasToken: data.canvas_access_token || "",
            canvasBaseUrl: data.canvas_base_url || "https://msmary.instructure.com",
            helpPoints: data.help_points || 0,
            studyStreaks: data.study_streaks || 0,
          });
        }
        setLoading(false);
      });
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: profile.fullName,
        university: profile.university,
        major: profile.major,
        grad_year: profile.gradYear ? parseInt(profile.gradYear) : null,
        study_interests: profile.studyInterests,
      })
      .eq("user_id", user.id);

    if (error) {
      toast({ title: "Error saving profile", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Profile saved!" });
    }
    setSaving(false);
  };

  const handleSaveCanvas = async () => {
    if (!user || !profile.canvasToken.trim()) return;
    setValidating(true);

    // Test the token against Canvas API
    const baseUrl = profile.canvasBaseUrl.replace(/\/$/, "");
    try {
      const res = await fetch(`${baseUrl}/api/v1/users/self`, {
        headers: { Authorization: `Bearer ${profile.canvasToken}` },
      });

      if (!res.ok) {
        toast({ title: "Invalid Canvas token", description: `Canvas returned ${res.status}. Please check your token.`, variant: "destructive" });
        setValidating(false);
        return;
      }

      const canvasUser = await res.json();

      // Save to profile
      const { error } = await supabase
        .from("profiles")
        .update({
          canvas_access_token: profile.canvasToken,
          canvas_base_url: baseUrl,
        })
        .eq("user_id", user.id);

      if (error) {
        toast({ title: "Error saving token", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Canvas connected!", description: `Authenticated as ${canvasUser.name || canvasUser.login_id}` });
      }
    } catch (err) {
      toast({ title: "Connection error", description: "Could not reach Canvas API. Check the base URL.", variant: "destructive" });
    }
    setValidating(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const initials = profile.fullName
    ? profile.fullName.split(" ").map((n) => n[0]).join("").toUpperCase()
    : "?";

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Profile & Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account and preferences</p>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-6">
            <div className="relative">
              <Avatar className="h-20 w-20">
                <AvatarFallback className="bg-primary text-primary-foreground text-xl">{initials}</AvatarFallback>
              </Avatar>
              <Button size="icon" variant="outline" className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full">
                <Camera className="h-3 w-3" />
              </Button>
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">{profile.fullName || "Student"}</h2>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              <div className="flex gap-2 mt-2">
                {profile.major && <Badge variant="secondary"><GraduationCap className="h-3 w-3 mr-1" /> {profile.major}</Badge>}
                {profile.gradYear && <Badge variant="outline"><Calendar className="h-3 w-3 mr-1" /> Class of {profile.gradYear}</Badge>}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-primary">{profile.helpPoints}</p><p className="text-xs text-muted-foreground">Help Points</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-secondary">{profile.studyStreaks}</p><p className="text-xs text-muted-foreground">Day Streak</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-success">—</p><p className="text-xs text-muted-foreground">Completion</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Personal Information</CardTitle></CardHeader>
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
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Changes
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Key className="h-5 w-5" /> Canvas Integration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Connect your Canvas LMS to sync courses and assignments automatically.</p>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Canvas Base URL</Label>
              <Input
                placeholder="https://yourschool.instructure.com"
                value={profile.canvasBaseUrl}
                onChange={(e) => setProfile({ ...profile, canvasBaseUrl: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Access Token</Label>
              <Input
                type="password"
                placeholder="Your Canvas API access token"
                value={profile.canvasToken}
                onChange={(e) => setProfile({ ...profile, canvasToken: e.target.value })}
              />
            </div>
            <Button onClick={handleSaveCanvas} disabled={validating || !profile.canvasToken.trim()} variant="outline" className="gap-2">
              {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Key className="h-4 w-4" />}
              Validate & Save
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
