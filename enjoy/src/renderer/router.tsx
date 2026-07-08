import { createHashRouter } from "react-router-dom";
import { Layout } from "@renderer/components";
import Conversations from "./pages/conversations";
import Conversation from "./pages/conversation";
import Vocabulary from "./pages/vocabulary";
import ErrorPage from "./pages/error-page";
import Landing from "./pages/landing";
import Audio from "./pages/audio";
import Video from "./pages/video";
import Audios from "./pages/audios";
import Videos from "./pages/videos";
import Documents from "./pages/documents";
import Document from "./pages/document";
import Home from "./pages/home";
import Notes from "./pages/notes";
import PronunciationAssessmentsIndex from "./pages/pronunciation-assessments/index";
import Chats from "./pages/chats";
import { ProtectedPage } from "./pages/protected-page";

export default createHashRouter([
  {
    path: "/",
    element: <Layout />,
    errorElement: <ErrorPage />,
    children: [
      { path: "/landing", element: <Landing /> },
      {
        index: true,
        element: (
          <ProtectedPage>
            <Home />
          </ProtectedPage>
        ),
      },
      {
        path: "/chats",
        element: (
          <ProtectedPage>
            <Chats />
          </ProtectedPage>
        ),
      },
      {
        path: "/conversations",
        element: (
          <ProtectedPage>
            <Conversations />
          </ProtectedPage>
        ),
      },
      {
        path: "/conversations/:id",
        element: (
          <ProtectedPage>
            <Conversation />
          </ProtectedPage>
        ),
      },
      {
        path: "/pronunciation_assessments",
        element: (
          <ProtectedPage>
            <PronunciationAssessmentsIndex />
          </ProtectedPage>
        ),
      },
      {
        path: "/vocabulary",
        element: (
          <ProtectedPage>
            <Vocabulary />
          </ProtectedPage>
        ),
      },
      {
        path: "/audios",
        element: (
          <ProtectedPage>
            <Audios />
          </ProtectedPage>
        ),
      },
      {
        path: "/audios/:id",
        element: (
          <ProtectedPage>
            <Audio />
          </ProtectedPage>
        ),
      },
      {
        path: "/videos",
        element: (
          <ProtectedPage>
            <Videos />
          </ProtectedPage>
        ),
      },
      {
        path: "/videos/:id",
        element: (
          <ProtectedPage>
            <Video />
          </ProtectedPage>
        ),
      },
      {
        path: "/documents",
        element: (
          <ProtectedPage>
            <Documents />
          </ProtectedPage>
        ),
      },
      {
        path: "/documents/:id",
        element: (
          <ProtectedPage>
            <Document />
          </ProtectedPage>
        ),
      },
      {
        path: "/notes",
        element: (
          <ProtectedPage>
            <Notes />
          </ProtectedPage>
        ),
      },
    ],
  },
]);
