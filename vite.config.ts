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

  return {
    base: "./",
    envPrefix: ["VITE_", "NEXT_PUBLIC_", "MARINA_"],
    define: {
      __MARINA_SUPABASE_URL__: JSON.stringify(supabaseUrl),
      __MARINA_SUPABASE_ANON_KEY__: JSON.stringify(supabaseAnonKey)
    },
    plugins: [react(), marinaDevIpcPlugin()],
    build: {
      target: "esnext"
    }
  };
});
