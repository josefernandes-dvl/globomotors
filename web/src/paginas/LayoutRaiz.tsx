import { Outlet, ScrollRestoration } from "react-router";

export function LayoutRaiz() {
  return (
    <>
      <Outlet />
      <ScrollRestoration />
    </>
  );
}
