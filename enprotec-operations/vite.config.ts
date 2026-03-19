import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import type { PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import { handleCreateUser } from './api/create-user';
import { handleSendInspectionWebhook } from './api/send-inspection';
import { handleUpdateUser } from './api/update-user';
import { handleDeleteUser } from './api/delete-user';

const createUserDevPlugin = (): PluginOption => ({
  name: 'enprotec-create-user-dev-api',
  configureServer(server) {
    server.middlewares.use('/api/create-user', async (req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, X-Inspection-Webhook-Url'
      );
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

      if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        res.end();
        return;
      }

      if (req.method !== 'POST') {
        res.statusCode = 405;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
      }

      try {
        let body = '';
        req.on('data', chunk => {
          body += chunk;
        });

        req.on('end', async () => {
          try {
            const payload = body ? JSON.parse(body) : undefined;
            const result = await handleCreateUser(payload);
            res.statusCode = result.status;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(result.body));
          } catch (error) {
            console.error('create-user dev handler failed:', error);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Failed to process request' }));
          }
        });
      } catch (error) {
        console.error('create-user dev handler error:', error);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Failed to process request' }));
      }
    });
  },
});

const updateUserDevPlugin = (): PluginOption => ({
  name: 'enprotec-update-user-dev-api',
  configureServer(server) {
    server.middlewares.use('/api/update-user', async (req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

      if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        res.end();
        return;
      }

      if (req.method !== 'POST') {
        res.statusCode = 405;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
      }

      try {
        let body = '';
        req.on('data', chunk => {
          body += chunk;
        });

        req.on('end', async () => {
          try {
            const payload = body ? JSON.parse(body) : undefined;
            const result = await handleUpdateUser(payload);
            res.statusCode = result.status;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(result.body));
          } catch (error) {
            console.error('update-user dev handler failed:', error);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Failed to process request' }));
          }
        });
      } catch (error) {
        console.error('update-user dev handler error:', error);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Failed to process request' }));
      }
    });
  },
});

const sendInspectionDevPlugin = (): PluginOption => ({
  name: 'enprotec-send-inspection-dev-api',
  configureServer(server) {
    server.middlewares.use('/api/send-inspection', async (req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, X-Inspection-Webhook-Url'
      );
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

      if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        res.end();
        return;
      }

      if (req.method !== 'POST') {
        res.statusCode = 405;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
      }

      try {
        let body = '';
        req.on('data', chunk => {
          body += chunk;
        });

        req.on('end', async () => {
          try {
            const payload = body ? JSON.parse(body) : undefined;
            const result = await handleSendInspectionWebhook(payload, req.headers);
            res.statusCode = result.status;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(result.body));
          } catch (error) {
            console.error('send-inspection dev handler failed:', error);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Failed to process request' }));
          }
        });
      } catch (error) {
        console.error('send-inspection dev handler error:', error);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Failed to process request' }));
      }
    });
  },
});

const deleteUserDevPlugin = (): PluginOption => ({
  name: 'enprotec-delete-user-dev-api',
  configureServer(server) {
    server.middlewares.use('/api/delete-user', async (req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

      if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        res.end();
        return;
      }

      if (req.method !== 'POST') {
        res.statusCode = 405;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
      }

      try {
        let body = '';
        req.on('data', chunk => {
          body += chunk;
        });

        req.on('end', async () => {
          try {
            const payload = body ? JSON.parse(body) : undefined;
            const result = await handleDeleteUser(payload);
            res.statusCode = result.status;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(result.body));
          } catch (error) {
            console.error('delete-user dev handler failed:', error);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Failed to process request' }));
          }
        });
      } catch (error) {
        console.error('delete-user dev handler error:', error);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Failed to process request' }));
      }
    });
  },
});

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.VITE_SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? env.VITE_SUPABASE_URL;
    process.env.SUPABASE_URL = process.env.SUPABASE_URL ?? env.SUPABASE_URL;
    process.env.INSPECTION_WEBHOOK_URL =
      process.env.INSPECTION_WEBHOOK_URL ?? env.INSPECTION_WEBHOOK_URL;
    return {
      server: {
        port: 3002,
        host: '0.0.0.0',
      },
      plugins: [react(), createUserDevPlugin(), updateUserDevPlugin(), sendInspectionDevPlugin(), deleteUserDevPlugin()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
