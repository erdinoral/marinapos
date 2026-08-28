import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { marinaDevIpcPlugin } from "./marinaDevIpcPlugin";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const supabaseUrl = (env.NEXT_PUBLIC_SUPABASE_URL || env.VITE_SUPABASE_URL || env.MARINA_SUPABASE_URL || "").trim();
  const supabaseAnonKey = (
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    env.VITE_SUPABASE_ANON_KEY ||
    env.MARINA_SUPABASE_ANON_KEY ||
    ""
  ).trim();
  const authRedirectUrl = (
    env.MARINA_AUTH_REDIRECT_URL ||
    env.VITE_AUTH_REDIRECT_URL ||
    "http://localhost:5174/uyelik-onay"
  ).trim();

  return {
    base: "./",
    envPrefix: ["VITE_", "NEXT_PUBLIC_", "MARINA_"],
    server: {
      port: 5173,
      strictPort: true
    },
    define: {
      __MARINA_SUPABASE_URL__: JSON.stringify(supabaseUrl),
      __MARINA_SUPABASE_ANON_KEY__: JSON.stringify(supabaseAnonKey),
      __MARINA_AUTH_REDIRECT_URL__: JSON.stringify(authRedirectUrl)
    },
    plugins: [react(), marinaDevIpcPlugin()],
    build: {
      target: "esnext"
    }
  };
});
