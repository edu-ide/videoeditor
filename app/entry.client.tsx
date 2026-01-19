import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";

// Import layouts and pages
import App from "./root";

// Lazy load routes for code splitting
import LandingPage from "./routes/_index";
import Projects from "./routes/projects";
import ProjectDetail from "./routes/project.$id";
import { EffectProvider } from "./lib/services/EffectReact";
import Login from "./routes/login";
import NotFound from "./NotFound";

// Project child routes (for LeftPanel Outlet)
import MediaBin from "./components/timeline/MediaBin";
import MediaBinPage from "./components/timeline/MediaBinPage";
import TextEditor from "./components/media/TextEditor";
import Transitions from "./components/media/Transitions";

// Define routes for SPA
const router = createBrowserRouter([
    {
        path: "/",
        element: <App />,
        errorElement: <NotFound />,
        children: [
            { index: true, element: <LandingPage /> },
            { path: "projects", element: <Projects /> },
            {
                path: "project/:id",
                element: <ProjectDetail />,
                children: [
                    // These are rendered via <Outlet> in LeftPanel.tsx
                    { index: true, element: <MediaBin /> },
                    { path: "media-bin", element: <MediaBinPage /> },
                    { path: "text-editor", element: <TextEditor /> },
                    { path: "transitions", element: <Transitions /> },
                ],
            },
            { path: "login", element: <Login /> },
            { path: "*", element: <NotFound /> },
        ],
    },
]);

const container = document.getElementById("root");
if (container) {
    const root = createRoot(container);
    root.render(
        <StrictMode>
            <RouterProvider router={router} />
        </StrictMode>
    );
}
