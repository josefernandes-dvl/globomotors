import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

let urlsCriadas = 0;

URL.createObjectURL = () => {
  urlsCriadas += 1;
  return `blob:teste/${urlsCriadas}`;
};
URL.revokeObjectURL = () => undefined;
Element.prototype.scrollIntoView = () => undefined;
window.scrollTo = () => undefined;

afterEach(() => {
  cleanup();
  sessionStorage.clear();
});
