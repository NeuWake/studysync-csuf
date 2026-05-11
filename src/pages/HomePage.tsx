import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent } from "@/components/ui/card";
import {
  GraduationCap,
  CalendarDays,
  ListChecks,
  MessageSquare,
  PenSquare,
  BarChart3,
  Sparkles,
  ArrowRight,
} from "lucide-react";

const features = [
  {
    icon: ListChecks,
    title: "Assignments",
    desc: "Sync Canvas assignments and track manual tasks with progress and due dates.",
  },
  {
    icon: CalendarDays,
    title: "Smart Calendar",
    desc: "See every due date, event, and study block in one unified, color-coded calendar.",
  },
  {
    icon: MessageSquare,
    title: "Group Chat",
    desc: "Real-time messaging with classmates — invite peers and coordinate group work.",
  },
  {
    icon: PenSquare,
    title: "Collaborative Whiteboard",
    desc: "Brainstorm, sketch diagrams, and solve problems together on a shared canvas.",
  },
  {
    icon: BarChart3,
    title: "Productivity Stats",
    desc: "Visualize your study habits, completion rates, and progress over time.",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl gradient-hero flex items-center justify-center">
              <GraduationCap className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold">StudySync</span>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost">
              <Link to="/auth">Sign in</Link>
            </Button>
            <Button asChild>
              <Link to="/auth">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/10 via-background to-secondary/10" />
        <div className="container mx-auto px-4 py-24 md:py-32 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground mb-6">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Built for CSUF students
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
            Your assignments, calendar, and study crew —{" "}
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              all in sync.
            </span>
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground mb-8">
            StudySync pulls together Canvas assignments, group chat, a
            collaborative whiteboard, and productivity insights into one
            focused workspace built for students.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild size="lg">
              <Link to="/auth">
                Start free <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="#features">See features</a>
            </Button>
            <Button asChild size="lg" variant="ghost">
              <a href="#faq">FAQ</a>
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 md:py-28">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold mb-3">Everything you need to stay on top of school</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              One app that replaces the dozen tabs you keep open during the semester.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <Card key={f.title} className="group hover:shadow-lg transition-shadow border-border/60">
                <CardContent className="p-6">
                  <div className="h-11 w-11 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold text-lg mb-1.5">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 bg-muted/30 border-y">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold mb-3">Get set up in minutes</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              { n: "1", t: "Create your account", d: "Sign up with your university email and verify in one click." },
              { n: "2", t: "Connect Canvas", d: "Paste your Canvas access token to auto-import every course and assignment." },
              { n: "3", t: "Sync & collaborate", d: "Invite classmates, attach files, and chart your progress." },
            ].map((s) => (
              <div key={s.n} className="text-center">
                <div className="mx-auto mb-4 h-12 w-12 rounded-full gradient-hero text-primary-foreground font-bold flex items-center justify-center">
                  {s.n}
                </div>
                <h3 className="font-semibold text-lg mb-2">{s.t}</h3>
                <p className="text-sm text-muted-foreground">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 md:py-28">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-3">Frequently asked questions</h2>
            <p className="text-muted-foreground">Everything you need to know about Canvas sync, privacy, and working with classmates.</p>
          </div>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="canvas-1">
              <AccordionTrigger>How does Canvas sync work?</AccordionTrigger>
              <AccordionContent>
                During onboarding you paste a personal Canvas access token. StudySync uses it to pull your active courses and assignments — including titles, due dates, and points — into your dashboard and calendar. New assignments appear automatically on each refresh.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="canvas-2">
              <AccordionTrigger>Will StudySync submit assignments or change my grades?</AccordionTrigger>
              <AccordionContent>
                No. We only request read access to your courses and assignments. StudySync never submits work, posts to discussions, or modifies anything in Canvas.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="canvas-3">
              <AccordionTrigger>Can I use StudySync without Canvas?</AccordionTrigger>
              <AccordionContent>
                Absolutely. You can skip Canvas onboarding and create assignments and tasks manually. You can connect Canvas later from your profile any time.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="privacy-1">
              <AccordionTrigger>Where is my data stored and who can see it?</AccordionTrigger>
              <AccordionContent>
                Your data lives in an encrypted backend with row-level security, meaning only you can read your assignments, files, and notes. Classmates only see content you explicitly share with them through chats or whiteboards.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="privacy-2">
              <AccordionTrigger>How is my Canvas token protected?</AccordionTrigger>
              <AccordionContent>
                Your Canvas token is stored encrypted in your private user record and is never exposed to other users. You can revoke it at any time from your profile or directly in Canvas.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="privacy-3">
              <AccordionTrigger>Do you sell or share my data?</AccordionTrigger>
              <AccordionContent>
                Never. StudySync does not sell, rent, or share your personal data with third parties. We only use it to power features inside the app.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="collab-1">
              <AccordionTrigger>How do I collaborate with classmates?</AccordionTrigger>
              <AccordionContent>
                Search for classmates by name or email and invite them to a chat or whiteboard. Once they accept, you can message in real time and brainstorm together on a shared canvas.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="collab-2">
              <AccordionTrigger>Can other people see my assignments?</AccordionTrigger>
              <AccordionContent>
                No. Assignments and tasks are private to you. Collaboration happens only inside chats and whiteboards you choose to create or join.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="collab-3">
              <AccordionTrigger>Can I leave or remove members from a group?</AccordionTrigger>
              <AccordionContent>
                Yes. Group chats and whiteboards have member management — owners can remove members, and any member can leave at any time.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="rounded-3xl bg-gradient-to-br from-primary to-secondary p-10 md:p-16 text-center text-primary-foreground">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to sync your semester?</h2>
            <p className="text-primary-foreground/90 max-w-xl mx-auto mb-8">
              Join students using StudySync to stay organized, collaborate better, and finish strong.
            </p>
            <Button asChild size="lg" variant="secondary">
              <Link to="/auth">
                Get started free <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-primary" />
            <span>© {new Date().getFullYear()} StudySync</span>
          </div>
          <div className="flex gap-6">
            <Link to="/auth" className="hover:text-foreground">Sign in</Link>
            <a href="#features" className="hover:text-foreground">Features</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
