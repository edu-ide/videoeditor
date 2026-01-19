import { useParams, useNavigate } from "react-router";
import React, { useEffect } from "react";
import TimelineEditor from "./home";

// Loader removed for SPA mode compatibility
// Authentication and timeline loading is handled client-side

export default function ProjectEditorRoute() {
  const params = useParams();
  const navigate = useNavigate();
  const id = params.id as string;

  useEffect(() => {
    // Lightweight guard: verify project ownership before showing editor
    (async () => {
      const res = await fetch(`/api/projects/${encodeURIComponent(id)}`, {
        credentials: "include",
      });
      if (!res.ok) navigate("/projects");
    })();
  }, [id, navigate]);

  // Pass through existing editor; it manages state internally.
  return <TimelineEditor />;
}

