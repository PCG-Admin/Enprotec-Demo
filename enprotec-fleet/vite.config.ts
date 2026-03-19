import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { createClient } from '@supabase/supabase-js';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  return {
    server: {
      port: 3003,
      host: '0.0.0.0',
    },
    plugins: [
      react(),
      // ── Dev-only API middleware (mirrors Vercel serverless functions) ──────
      {
        name: 'api-dev-server',
        configureServer(server) {
          const supabaseUrl = env.VITE_SUPABASE_URL;
          const serviceKey  = env.SUPABASE_SERVICE_ROLE_KEY;

          server.middlewares.use('/api/create-user', async (req, res) => {
            if (req.method !== 'POST') { res.statusCode = 405; res.end('Method Not Allowed'); return; }
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', async () => {
              try {
                const payload = JSON.parse(body);
                if (!supabaseUrl || !serviceKey) {
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: 'SUPABASE_SERVICE_ROLE_KEY not set in .env' }));
                  return;
                }
                const admin = createClient(supabaseUrl, serviceKey, {
                  auth: { autoRefreshToken: false, persistSession: false },
                });
                const { data, error } = await admin.auth.admin.createUser({
                  email: payload.email,
                  password: payload.password,
                  email_confirm: true,
                  user_metadata: { name: payload.name, role: payload.role },
                });
                if (error || !data?.user) {
                  res.statusCode = 400;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: error?.message ?? 'Failed to create auth user' }));
                  return;
                }
                const { error: profileError } = await admin.from('enprotec_users').upsert({
                  id:          data.user.id,
                  name:        payload.name,
                  email:       payload.email,
                  role:        payload.role,
                  password:    'Supabase-Auth-Managed',
                  status:      payload.status ?? 'Active',
                  fleet_role:  payload.fleet_role ?? null,
                  sites:       payload.sites ?? [],
                  departments: payload.departments ?? [],
                });
                if (profileError) {
                  await admin.auth.admin.deleteUser(data.user.id);
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: profileError.message }));
                  return;
                }
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ id: data.user.id, ...payload }));
              } catch (e) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: String(e) }));
              }
            });
          });

          server.middlewares.use('/api/delete-user', async (req, res) => {
            if (req.method !== 'POST') { res.statusCode = 405; res.end('Method Not Allowed'); return; }
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', async () => {
              try {
                const { userId } = JSON.parse(body);
                if (!supabaseUrl || !serviceKey) {
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: 'SUPABASE_SERVICE_ROLE_KEY not set in .env' }));
                  return;
                }
                const admin = createClient(supabaseUrl, serviceKey, {
                  auth: { autoRefreshToken: false, persistSession: false },
                });
                await admin.from('enprotec_users').delete().eq('id', userId);
                const { error } = await admin.auth.admin.deleteUser(userId);
                res.statusCode = error ? 500 : 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(error ? { error: error.message } : { success: true }));
              } catch (e) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: String(e) }));
              }
            });
          });

          server.middlewares.use('/api/update-user', async (req, res) => {
            if (req.method !== 'POST') { res.statusCode = 405; res.end('Method Not Allowed'); return; }
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', async () => {
              try {
                const { id, ...updates } = JSON.parse(body);
                if (!supabaseUrl || !serviceKey) {
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: 'SUPABASE_SERVICE_ROLE_KEY not set in .env' }));
                  return;
                }
                const admin = createClient(supabaseUrl, serviceKey, {
                  auth: { autoRefreshToken: false, persistSession: false },
                });
                const { data, error } = await admin
                  .from('enprotec_users')
                  .update(updates)
                  .eq('id', id)
                  .select()
                  .single();
                res.statusCode = error ? 500 : 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(error ? { error: error.message } : data));
              } catch (e) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: String(e) }));
              }
            });
          });
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
