
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Enable CORS for all routes to prevent fetch errors in iframe
  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  // API Proxy Route for Supabase to bypass CORS/CSP in iframe
  app.post('/api/project/config', async (req, res) => {
    console.log(' [Server] Proxying Supabase Config Update...');
    const { projectId, userId, config, supabaseUrl, supabaseKey } = req.body;
    
    if (!projectId || !userId || !config || !supabaseUrl || !supabaseKey) {
      console.error(' [Server] Missing parameters for Supabase proxy');
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    try {
      const url = `${supabaseUrl}/rest/v1/projects?id=eq.${projectId}&user_id=eq.${userId}`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
          'Connection': 'keep-alive'
        },
        body: JSON.stringify({ config, updated_at: new Date().toISOString() })
      });

      if (response.ok) {
        console.log(' [Server] Supabase Config Update Success');
        return res.json({ success: true });
      } else {
        const errorData = await response.json();
        console.error(' [Server] Supabase Config Update Failed:', errorData);
        return res.status(response.status).json(errorData);
      }
    } catch (error: any) {
      console.error(' [Server] Supabase Proxy Error:', error);
      return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
  });

  // API Proxy Route for OpenRouter
  app.post('/api/ai/openrouter', async (req, res) => {
    const { model, messages, temperature, apiKey } = req.body;
    console.log(` [Server] Proxying OpenRouter Request for model: ${model}`);
    
    if (!apiKey) {
      console.error(' [Server] Missing API Key for OpenRouter proxy');
      return res.status(400).json({ error: 'Missing API Key' });
    }

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://ai.studio/build',
          'X-Title': 'AI Studio Build',
          'Connection': 'keep-alive'
        },
        body: JSON.stringify({ model, messages, temperature })
      });

      const data = await response.json();
      if (response.ok) {
        console.log(' [Server] OpenRouter Success');
        res.setHeader('Content-Type', 'application/json');
        return res.json(data);
      } else {
        console.error(' [Server] OpenRouter Failed:', data);
        return res.status(response.status).json(data);
      }
    } catch (error: any) {
      console.error(' [Server] OpenRouter Proxy Error:', error);
      return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
  });

  // API Proxy Route for Gemini
  app.post('/api/ai/gemini', async (req, res) => {
    console.log(' [Server] Proxying Gemini Request...');
    const { model, contents, config, apiKey } = req.body;
    
    if (!apiKey) {
      console.error(' [Server] Missing API Key for Gemini proxy');
      return res.status(400).json({ error: 'Missing API Key' });
    }

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      
      const { systemInstruction, ...generationConfig } = config || {};
      const body: any = { contents, generationConfig };
      if (systemInstruction) body.systemInstruction = systemInstruction;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Connection': 'keep-alive'
        },
        body: JSON.stringify(body)
      });

      const data = await response.json();
      if (response.ok) {
        console.log(' [Server] Gemini Success');
        res.setHeader('Content-Type', 'application/json');
        return res.json(data);
      } else {
        console.error(' [Server] Gemini Failed:', data);
        return res.status(response.status).json(data);
      }
    } catch (error: any) {
      console.error(' [Server] Gemini Proxy Error:', error);
      return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: false, // Disable HMR to prevent WebSocket errors in iframe
        watch: null // Disable watching to save resources
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(` [Server] Running on http://localhost:${PORT}`);
  });
}

startServer();
