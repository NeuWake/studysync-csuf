import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CanvasCourse {
  id: number;
  name: string;
  course_code: string;
  workflow_state: string;
}

interface CanvasAssignment {
  id: number;
  name: string;
  description: string | null;
  due_at: string | null;
  points_possible: number | null;
  submission_types: string[];
  course_id: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from JWT
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!);
    const { data: { user }, error: userError } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user's Canvas credentials from profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("canvas_access_token, canvas_base_url")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile?.canvas_access_token) {
      return new Response(JSON.stringify({ error: "Canvas access token not configured. Please add it in your profile settings." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const canvasToken = profile.canvas_access_token;
    const canvasBaseUrl = (profile.canvas_base_url || "https://canvas.instructure.com").replace(/\/$/, "");

    // 1. Fetch courses from Canvas
    const coursesRes = await fetch(`${canvasBaseUrl}/api/v1/courses?per_page=100&enrollment_state=active&include[]=total_scores`, {
      headers: { Authorization: `Bearer ${canvasToken}` },
    });

    if (!coursesRes.ok) {
      const errText = await coursesRes.text();
      return new Response(JSON.stringify({ error: `Canvas API error (courses): ${coursesRes.status} - ${errText}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const canvasCourses: CanvasCourse[] = await coursesRes.json();
    const activeCourses = canvasCourses.filter((c) => c.workflow_state === "available");

    const courseColors = [
      "#F97316", "#3B82F6", "#22C55E", "#EAB308", "#EF4444",
      "#8B5CF6", "#EC4899", "#14B8A6", "#F59E0B", "#6366F1",
    ];

    let syncedCourses = 0;
    let syncedAssignments = 0;
    const errors: string[] = [];

    for (let i = 0; i < activeCourses.length; i++) {
      const cc = activeCourses[i];

      // Upsert course
      const { data: existingCourse } = await supabase
        .from("courses")
        .select("id")
        .eq("canvas_course_id", String(cc.id))
        .maybeSingle();

      let courseId: string;

      if (existingCourse) {
        courseId = existingCourse.id;
        await supabase
          .from("courses")
          .update({ name: cc.name, code: cc.course_code })
          .eq("id", courseId);
      } else {
        const { data: newCourse, error: insertErr } = await supabase
          .from("courses")
          .insert({
            canvas_course_id: String(cc.id),
            name: cc.name,
            code: cc.course_code,
            color: courseColors[i % courseColors.length],
          })
          .select("id")
          .single();

        if (insertErr || !newCourse) {
          errors.push(`Failed to insert course ${cc.name}: ${insertErr?.message}`);
          continue;
        }
        courseId = newCourse.id;
      }

      // Enroll user in course
      await supabase
        .from("user_courses")
        .upsert({ user_id: user.id, course_id: courseId }, { onConflict: "user_id,course_id" });

      syncedCourses++;

      // 2. Fetch assignments for this course
      try {
        const assignRes = await fetch(
          `${canvasBaseUrl}/api/v1/courses/${cc.id}/assignments?per_page=100&order_by=due_at`,
          { headers: { Authorization: `Bearer ${canvasToken}` } }
        );

        if (!assignRes.ok) {
          const errText = await assignRes.text();
          errors.push(`Canvas API error (assignments for ${cc.name}): ${assignRes.status} - ${errText}`);
          continue;
        }

        const canvasAssignments: CanvasAssignment[] = await assignRes.json();

        for (const ca of canvasAssignments) {
          // Determine assignment type from submission_types
          let assignType = "other";
          const types = ca.submission_types || [];
          if (types.includes("online_quiz")) assignType = "quiz";
          else if (types.includes("online_upload") || types.includes("online_text_entry")) assignType = "homework";
          else if (types.includes("discussion_topic")) assignType = "essay";

          // Upsert assignment
          const { data: existingAssign } = await supabase
            .from("assignments")
            .select("id")
            .eq("canvas_assignment_id", String(ca.id))
            .maybeSingle();

          let assignmentId: string;

          if (existingAssign) {
            assignmentId = existingAssign.id;
            await supabase
              .from("assignments")
              .update({
                title: ca.name,
                description: ca.description,
                due_date: ca.due_at,
                max_points: ca.points_possible,
                assignment_type: assignType,
              })
              .eq("id", assignmentId);
          } else {
            const { data: newAssign, error: aErr } = await supabase
              .from("assignments")
              .insert({
                canvas_assignment_id: String(ca.id),
                course_id: courseId,
                title: ca.name,
                description: ca.description,
                due_date: ca.due_at,
                max_points: ca.points_possible,
                assignment_type: assignType,
                created_by: user.id,
              })
              .select("id")
              .single();

            if (aErr || !newAssign) {
              errors.push(`Failed to insert assignment ${ca.name}: ${aErr?.message}`);
              continue;
            }
            assignmentId = newAssign.id;
          }

          // Create user_assignment record
          await supabase
            .from("user_assignments")
            .upsert(
              { user_id: user.id, assignment_id: assignmentId, status: "pending" },
              { onConflict: "user_id,assignment_id" }
            );

          syncedAssignments++;
        }
      } catch (assignFetchErr) {
        errors.push(`Error fetching assignments for ${cc.name}: ${String(assignFetchErr)}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        synced_courses: syncedCourses,
        synced_assignments: syncedAssignments,
        total_canvas_courses: activeCourses.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Canvas sync error:", err);
    return new Response(
      JSON.stringify({ error: `Internal error: ${err instanceof Error ? err.message : String(err)}` }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
