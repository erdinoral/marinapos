import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { marinaDevIpcPlugin } from "./marinaDevIpcPlugin";

export default defineConfig({
  plugins: [react(), marinaDevIpcPlugin()]
});
