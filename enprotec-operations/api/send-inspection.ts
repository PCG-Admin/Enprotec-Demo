import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { IncomingHttpHeaders } from 'http';

interface HandlerResult {
  status: number;
  body: Record<string, unknown>;
}

interface InspectionWebhookPayload {
  inspectionId?: string;
  inspection_id?: string;
}

const resolveWebhookUrl = (headers: IncomingHttpHeaders): string | null => {
  const envUrl = process.env.INSPECTION_WEBHOOK_URL;
  if (typeof envUrl === 'string' && envUrl.trim().length > 0) {
    return envUrl.trim();
  }

  const headerValue = headers['x-inspection-webhook-url'];
  if (typeof headerValue === 'string' && headerValue.trim().length > 0) {
    return headerValue.trim();
  }

  return null;
};

export const handleSendInspectionWebhook = async (
  payload: unknown,
  headers: IncomingHttpHeaders = {}
): Promise<HandlerResult> => {
  if (process.env.APP_ENV === 'dev') {
    console.log('[Inspection Webhook] Dev environment — webhook suppressed.');
    return { status: 200, body: { success: true, suppressed: true } };
  }

  const webhookUrl = resolveWebhookUrl(headers);

  if (!webhookUrl) {
    return {
      status: 400,
      body: {
        error:
          'Inspection webhook URL is not configured. Set INSPECTION_WEBHOOK_URL env variable or send x-inspection-webhook-url header.',
      },
    };
  }

  if (!payload || typeof payload !== 'object') {
    return {
      status: 400,
      body: { error: 'Inspection payload must be a JSON object.' },
    };
  }

  const { inspectionId, inspection_id } = payload as InspectionWebhookPayload;
  const resolvedInspectionId = inspectionId ?? inspection_id;

  if (!resolvedInspectionId) {
    return {
      status: 400,
      body: { error: 'Inspection payload must include inspectionId.' },
    };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const message = await response.text();
      return {
        status: 502,
        body: {
          error: 'Remote webhook call failed.',
          message,
          status: response.status,
        },
      };
    }

    return {
      status: 200,
      body: { success: true },
    };
  } catch (error) {
    return {
      status: 500,
      body: {
        error: 'Failed to invoke inspection webhook.',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
};

const inspectionWebhookHandler = async (
  req: VercelRequest,
  res: VercelResponse
) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).send('OK');
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let requestBody = req.body;

  if (!requestBody || typeof requestBody !== 'object') {
    try {
      requestBody = JSON.parse(req.body as string);
    } catch {
      return res
        .status(400)
        .json({ error: 'Invalid JSON payload for inspection webhook.' });
    }
  }

  const { status, body } = await handleSendInspectionWebhook(requestBody, req.headers);
  res.status(status).json(body);
};

export default inspectionWebhookHandler;

export const config = {
  runtime: 'nodejs',
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};
