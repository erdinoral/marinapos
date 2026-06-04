/** .env.local (Next/Akiyom) veya MARINA_* degiskenlerinden Supabase baglanti bilgisi */
export function readSupabaseCredentialsFromEnv(): { url: string; anonKey: string } {
  const url = (
    process.env.MARINA_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    ""
  ).trim();
  const anonKey = (
    process.env.MARINA_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    ""
  ).trim();
  return { url, anonKey };
}
