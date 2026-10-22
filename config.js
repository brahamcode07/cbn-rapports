// Réglages de connexion à Supabase (projet cbn_rapports).
// Ces deux valeurs sont faites pour être publiques : les règles d'accès
// de la base protègent les données. Ne mettez JAMAIS ici la clé « service_role ».
window.CBN_CONFIG = {
  SUPABASE_URL: 'https://rfsdzypatxbgolwfgpui.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmc2R6eXBhdHhiZ29sd2ZncHVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI0MTc1ODQsImV4cCI6MjEwNzk5MzU4NH0.eRl9FXgTD53VCuSctPAEcFtm2fibH50e4a7QTX-PiPM',
  DOMAINE_EMAIL: 'cbn-rapports.app',
  FUSEAU: 'Africa/Douala',
  // Clé publique des notifications (la clé privée reste dans Supabase)
  VAPID_PUBLIC: 'BLotVd_cR2bKAy0O0r7XesU4IRyz3HFObJRDEibus9vGFVw8J1ZE9dZUBTg-xDP0oxFInheIl2iXXY8rjo4KolA'
};
