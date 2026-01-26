import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://smtwovdnlqaajqevfqcz.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtdHdvdmRubHFhYWpxZXZmcWN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzODg0ODUsImV4cCI6MjA4NDk2NDQ4NX0.kDt9waz0pnRz74bVgivc1BQYUi_AFcxvrLNXCv6naI4';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
