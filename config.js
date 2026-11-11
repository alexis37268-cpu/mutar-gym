// =====================================================================
// Conexión con Supabase (proyecto Mutar Gym).
// Si se dejan vacíos, la app arranca en MODO PRUEBA (datos guardados
// solo en este navegador).
//
// Dónde están: Supabase > Project Settings > Data API / API Keys
//   - Project URL      -> SUPABASE_URL
//   - publishable key  -> SUPABASE_KEY  (es pública a propósito: la
//                         seguridad la ponen el login, GRANT y RLS)
// NUNCA poner acá la secret key ni la service_role.
// =====================================================================
export const SUPABASE_URL = "https://lcefdplzoklighyjceid.supabase.co";
export const SUPABASE_KEY = "sb_publishable_vc3ZnTEnbctrBj09RsxNCQ_oe0hrcIv";
