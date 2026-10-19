import { createClient } from '@supabase/supabase-js';
import { publicConfig } from './public-config';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL||publicConfig.url;
const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||publicConfig.key;
export const db=url&&key?createClient(url,key):null;
