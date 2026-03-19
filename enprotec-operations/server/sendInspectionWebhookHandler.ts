import { INSPECTION_WEBHOOK_URL } from '../config/webhooks';

interface HandlerResult {
  status: number;
  body: Record<string, unknown>;
}

export const handleSendInspectionWebhook = async (
  payload: unknown
): Promise<HandlerResult> => {
  if (!payload || typeof payload !== 'object') {
    return {
      status: 400,
      body: { error: 'Invalid or missing payload.' },
    };
  }

  const webhookUrl =
    process.env.INSPECTION_WEBHOOK_URL || INSPECTION_WEBHOOK_URL;

  let forwardPayload = payload as Record<string, unknown>;

  try {
    const maybeFile = (forwardPayload as Record<string, unknown>).file as
      | Record<string, unknown>
      | undefined;

    if (
      maybeFile &&
      typeof maybeFile === 'object' &&
      typeof maybeFile.data === 'string' &&
      typeof maybeFile.encoding === 'string' &&
      maybeFile.encoding === 'base64'
    ) {
      const buffer = Buffer.from(maybeFile.data, 'base64');
      forwardPayload = {
        ...forwardPayload,
        file: {
          ...maybeFile,
          data: Array.from(buffer.values()),
          size: buffer.length,
          encoding: 'binary',
        },
      };
    }
  } catch (error) {
    console.error('Failed to transform inspection payload:', error);
    return {
      status: 500,
      body: {
        error: 'Failed to transform inspection payload.',
        details:
          error instanceof Error ? error.message : 'Unknown transformation error',
      },
    };
  }

  try {
    const payloadSize = Buffer.byteLength(JSON.stringify(forwardPayload), 'utf8');
    console.log(
      `[InspectionWebhook] Forwarding payload (~${(
        payloadSize / 1024
      ).toFixed(2)} KB) to ${webhookUrl}`
    );

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(forwardPayload),
    });

    const responseBody = await response.text().catch(() => '');

    if (!response.ok) {
      console.error(
        `[InspectionWebhook] Webhook returned ${response.status}: ${responseBody}`
      );
      return {
        status: response.status,
        body: {
          error:
            responseBody ||
            'Webhook call failed without additional error information.',
        },
      };
    }

    return {
      status: 200,
      body: {
        success: true,
        webhookStatus: response.status,
      },
    };
  } catch (error) {
    console.error('Failed to call inspection webhook:', error);
    return {
      status: 500,
      body: {
        error: 'Failed to forward inspection payload to webhook.',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
};
