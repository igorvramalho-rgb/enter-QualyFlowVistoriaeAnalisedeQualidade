import { lazy, Suspense } from "react";
import { Navigate } from "react-router-dom";
import AppShell from "./components/layout/app-shell";
import { RouteFallback } from "./components/common/route-fallback";

const Analista = lazy(() => import("./pages/Analista"));
const Login = lazy(() => import("./pages/Login"));
const Usuarios = lazy(() => import("./pages/Usuarios"));
const Backup = lazy(() => import("./pages/Backup"));
const RelatorioBi = lazy(() => import("./pages/RelatorioBi"));
const Emissor = lazy(() => import("./pages/Emissor"));
const NotFound = lazy(() => import("./pages/NotFound"));

export const routers = [
  {
    path: "/login",
    name: "login",
    element: (
      <Suspense fallback={<RouteFallback />}>
        <Login />
      </Suspense>
    ),
  },
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, name: "home", element: <Navigate to="/emissor" replace /> },
      {
        path: "emissor",
        name: "emissor",
        element: (
          <Suspense fallback={<RouteFallback />}>
            <Emissor />
          </Suspense>
        ),
      },
      {
        path: "relatorio-bi",
        name: "relatorio-bi",
        element: (
          <Suspense fallback={<RouteFallback />}>
            <RelatorioBi />
          </Suspense>
        ),
      },
      {
        path: "backup",
        name: "backup",
        element: (
          <Suspense fallback={<RouteFallback />}>
            <Backup />
          </Suspense>
        ),
      },
      {
        path: "usuarios",
        name: "usuarios",
        element: (
          <Suspense fallback={<RouteFallback />}>
            <Usuarios />
          </Suspense>
        ),
      },
      {
        path: "analista",
        name: "analista",
        element: (
          <Suspense fallback={<RouteFallback />}>
            <Analista />
          </Suspense>
        ),
      },
    ],
  },
  /* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */
  {
    path: "*",
    name: "404",
    element: (
      <Suspense fallback={<RouteFallback />}>
        <NotFound />
      </Suspense>
    ),
  },
];

declare global {
  interface Window {
    __routers__: typeof routers;
  }
}

window.__routers__ = routers;
