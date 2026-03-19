import type { IncomingHttpHeaders } from 'http'

const INSPECTION_WEBHOOK_URL = process.env.INSPECTION_WEBHOOK_URL;

interface HandlerResult {
  status: number;
  body: Record<string, unknown>;
}

interface InspectionWebhookPayload {
  inspectionId?: string;
  inspection_id?: string;
}

const resolveWebhookUrl = (headers: IncomingHttpHeaders): string | null => {
  if (INSPECTION_WEBHOOK_URL) {
    return INSPECTION_WEBHOOK_URL;
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
