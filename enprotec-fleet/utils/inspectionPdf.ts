import { jsPDF } from 'jspdf';
import {
  InspectionDetail,
  InspectionResponseDetail,
} from '../types/inspection';
import {
  InspectionItemLike,
  isFailureAnswer,
  normaliseAnswer,
} from './inspection';

interface AugmentedResponse {
  response: InspectionResponseDetail;
  index: number;
  key: string;
  itemLike: InspectionItemLike;
  normalizedCondition: 'yes' | 'no' | null;
  isFail: boolean;
}

const toItemLike = (
  item?: InspectionResponseDetail['item'] | null
): InspectionItemLike => ({
  question: item?.question ?? null,
  category: item?.category ?? null,
  correct_answer: item?.correct_answer ?? null,
});

const fetchImageAsDataUrl = async (url: string): Promise<string | null> => {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }
    const blob = await response.blob();
    return await compressImageBlob(blob);
  } catch (error) {
    console.error('Unable to embed inspection photo in PDF', error);
    return null;
  }
};

const compressImageBlob = async (blob: Blob): Promise<string> => {
  if (typeof document === 'undefined') {
    return await blobToDataUrl(blob);
  }

  try {
    const objectUrl = URL.createObjectURL(blob);
    const imageElement = await loadImage(objectUrl);
    URL.revokeObjectURL(objectUrl);

    const maxWidth = 1280;
    const maxHeight = 960;
    const { width, height } = imageElement;

    const scale = Math.min(maxWidth / width, maxHeight / height, 1);
    const targetWidth = Math.max(Math.round(width * scale), 1);
    const targetHeight = Math.max(Math.round(height * scale), 1);

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Failed to get canvas context for image compression');
    }

    context.drawImage(imageElement, 0, 0, targetWidth, targetHeight);

    // Prefer JPEG to keep size small; fall back to PNG if JPEG fails.
    const quality = 0.75;
    const jpegDataUrl = canvas.toDataURL('image/jpeg', quality);
    if (jpegDataUrl && jpegDataUrl.length > 0) {
      return jpegDataUrl;
    }

    return await blobToDataUrl(blob);
  } catch (error) {
    console.warn('Image compression failed, using original', error);
    return await blobToDataUrl(blob);
  }
};

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load inspection image for compression'));
    img.src = src;
  });

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () =>
      reject(reader.error ?? new Error('Failed to convert inspection image to data URL'));
    reader.readAsDataURL(blob);
  });

export const createInspectionPdfDocument = async (
  inspection: InspectionDetail
): Promise<jsPDF> => {
  const responses: InspectionResponseDetail[] = inspection.responses ?? [];

  const augmentedResponses: AugmentedResponse[] = responses.map((response, index) => {
    const itemLike = toItemLike(response.item);
    const normalizedCondition = normaliseAnswer(response.condition);
    return {
      response,
      index,
      key: response.id || `${inspection.id}-${index}`,
      itemLike,
      normalizedCondition,
      isFail: isFailureAnswer(itemLike, normalizedCondition),
    };
  });

  const responseImages = new Map<string, string>();
  const logoPromise = fetchImageAsDataUrl('/Enprotec-logo.jpg');
  const imageFetches: Promise<void>[] = [];

  augmentedResponses.forEach(({ response, key }) => {
    if (!response.photo_url) return;
    imageFetches.push(
      fetchImageAsDataUrl(response.photo_url).then(dataUrl => {
        if (dataUrl) {
          responseImages.set(key, dataUrl);
        }
      })
    );
  });

  let logoDataUrl: string | null = null;
  await Promise.all([
    logoPromise.then(dataUrl => {
      logoDataUrl = dataUrl;
    }),
    ...imageFetches,
  ]);

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let pageWidth = doc.internal.pageSize.getWidth();
  let pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 18;
  const marginBottom = 20;
  const lineHeight = 4.8;

  const colors = {
    primary: { r: 0, g: 84, b: 166 },
    accent: { r: 14, g: 165, b: 233 },
    text: { r: 45, g: 55, b: 72 },
    muted: { r: 100, g: 116, b: 139 },
    surface: { r: 236, g: 244, b: 252 },
    surfaceAlt: { r: 248, g: 250, b: 252 },
    border: { r: 203, g: 213, b: 225 },
    danger: { r: 220, g: 38, b: 38 },
    success: { r: 22, g: 163, b: 74 },
  };

  let y = 0;

  const initPage = (isFirstPage: boolean) => {
    const headerHeight = isFirstPage ? 44 : 30;
    doc.setFillColor(colors.primary.r, colors.primary.g, colors.primary.b);
    doc.rect(0, 0, pageWidth, headerHeight, 'F');

    let headerTextStartX = marginX;
    if (logoDataUrl) {
      const logoFormat = logoDataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
      const { width: logoNativeWidth, height: logoNativeHeight } = doc.getImageProperties(logoDataUrl);
      let logoWidth = isFirstPage ? 56 : 40;
      let logoHeight = (logoNativeHeight * logoWidth) / logoNativeWidth;
      if (logoHeight > headerHeight - 10) {
        logoHeight = headerHeight - 10;
        logoWidth = (logoNativeWidth * logoHeight) / logoNativeHeight;
      }
      const logoY = headerHeight / 2 - logoHeight / 2;
      doc.addImage(logoDataUrl, logoFormat, marginX, logoY, logoWidth, logoHeight);
      headerTextStartX = marginX + logoWidth + 8;
    }

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(isFirstPage ? 16 : 12);
    const titleY = isFirstPage ? 22 : 17;
    doc.text('Enprotec Inspection Report', headerTextStartX, titleY);

    if (isFirstPage) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text('Professional insights powered by Enprotec workflows', headerTextStartX, titleY + 6);
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);

    return headerHeight + 14;
  };

  const startNewPage = (isFirstPage = false) => {
    if (!isFirstPage) {
      doc.addPage();
      pageWidth = doc.internal.pageSize.getWidth();
      pageHeight = doc.internal.pageSize.getHeight();
    }
    y = initPage(isFirstPage);
  };

  const ensureSpace = (requiredHeight: number) => {
    if (y + requiredHeight > pageHeight - marginBottom) {
      startNewPage();
    }
  };

  const drawSectionHeading = (title: string) => {
    ensureSpace(18);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(colors.primary.r, colors.primary.g, colors.primary.b);
    doc.text(title, marginX, y);
    y += 8;
    doc.setDrawColor(colors.primary.r, colors.primary.g, colors.primary.b);
    doc.setLineWidth(0.5);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 6;
    doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);
  };

  const drawSubheading = (title: string) => {
    ensureSpace(14);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(colors.accent.r, colors.accent.g, colors.accent.b);
    doc.text(title, marginX, y);
    y += 5;
    doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);
  };

  const renderResponseTable = (entries: AugmentedResponse[]) => {
    if (!entries.length) return;

    const cardPadding = 6;
    const maxWidth = pageWidth - marginX * 2;
    const rowHeight = 7.8;
    const headerHeight = 10;
    const columnWidths = [40, 32, maxWidth - 40 - 32];

    ensureSpace(headerHeight + rowHeight);

    doc.setFillColor(colors.surface.r, colors.surface.g, colors.surface.b);
    doc.roundedRect(marginX, y, maxWidth, headerHeight, 3, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(colors.primary.r, colors.primary.g, colors.primary.b);
    doc.text('Item', marginX + cardPadding, y + 6.4);
    doc.text('Result', marginX + cardPadding + columnWidths[0], y + 6.4);
    doc.text('Notes / Details', marginX + cardPadding + columnWidths[0] + columnWidths[1], y + 6.4);

    y += headerHeight;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);

    entries.forEach(entry => {
      ensureSpace(rowHeight);
      const itemLabel = entry.response.item?.question?.trim() ?? `Checklist item ${entry.index + 1}`;
      const resultLabel = (entry.response.condition ?? entry.normalizedCondition ?? 'N/A')
        .toString()
        .toUpperCase();
      const notesLabel = entry.response.notes?.trim() ?? '—';

      doc.setFillColor(colors.surfaceAlt.r, colors.surfaceAlt.g, colors.surfaceAlt.b);
      doc.roundedRect(marginX, y - 1, maxWidth, rowHeight + 2, 2, 2, 'F');

      const itemLines = doc.splitTextToSize(itemLabel, columnWidths[0] - cardPadding);
      const notesLines = doc.splitTextToSize(notesLabel, columnWidths[2] - cardPadding);

      const rowContentHeight = Math.max(itemLines.length, notesLines.length) * 4.2;
      ensureSpace(rowContentHeight);

      doc.text(itemLines, marginX + cardPadding, y + 4);

      const resultColor = entry.isFail ? colors.danger : colors.success;
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(resultColor.r, resultColor.g, resultColor.b);
      doc.text(resultLabel, marginX + cardPadding + columnWidths[0], y + 4);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);

      doc.text(notesLines, marginX + cardPadding + columnWidths[0] + columnWidths[1], y + 4);

      y += rowContentHeight + 2;
    });

    y += 4;
  };

  const vehicleLabelParts: string[] = [];
  const registration = inspection.vehicle?.registration_number?.trim();
  const make = inspection.vehicle?.make?.trim();
  const model = inspection.vehicle?.model?.trim();
  if (registration) vehicleLabelParts.push(registration);
  if (make || model) {
    vehicleLabelParts.push([make, model].filter(Boolean).join(' '));
  }
  const vehicleLabel = vehicleLabelParts.filter(Boolean).join(' - ') || 'Vehicle not recorded';

  startNewPage(true);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);
  doc.text('Inspection Overview', marginX, y);
  y += 10;

  const overviewEntries = [
    {
      label: 'Inspection Date',
      value: inspection.inspection_date
        ? new Date(inspection.inspection_date).toLocaleString()
        : 'Not recorded',
    },
    {
      label: 'Site',
      value: inspection.site ?? 'Not recorded',
    },
    {
      label: 'Vehicle',
      value: vehicleLabel,
    },
    {
      label: 'Driver',
      value:
        inspection.driver?.full_name || inspection.driver?.email
          ? `${inspection.driver?.full_name ?? 'Unknown driver'}${
              inspection.driver?.email ? ` (${inspection.driver.email})` : ''
            }`
          : 'Not recorded',
    },
    {
      label: 'Odometer',
      value:
        inspection.odometer != null
          ? `${inspection.odometer.toLocaleString()} km`
          : 'Not recorded',
    },
    {
      label: 'Overall Status',
      value: inspection.overall_status
        ? inspection.overall_status.toUpperCase()
        : 'Pending',
      emphasize:
        inspection.overall_status?.toLowerCase() === 'fail'
          ? 'danger'
          : inspection.overall_status?.toLowerCase() === 'pass'
          ? 'success'
          : undefined,
    },
  ] as const;

  const cardHeight = overviewEntries.length * 12 + 16;
  ensureSpace(cardHeight);
  doc.setFillColor(colors.surfaceAlt.r, colors.surfaceAlt.g, colors.surfaceAlt.b);
  doc.roundedRect(marginX, y, pageWidth - marginX * 2, cardHeight, 4, 4, 'F');

  let overviewY = y + 12;
  const cardPadding = 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  overviewEntries.forEach(entry => {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(colors.muted.r, colors.muted.g, colors.muted.b);
    doc.text(entry.label, marginX + cardPadding, overviewY);

    doc.setFont('helvetica', 'normal');
    let textColor = colors.text;
    if (entry.emphasize === 'danger') {
      textColor = colors.danger;
    } else if (entry.emphasize === 'success') {
      textColor = colors.success;
    }
    doc.setTextColor(textColor.r, textColor.g, textColor.b);

    const valueLines = doc.splitTextToSize(
      entry.value,
      pageWidth - marginX * 2 - cardPadding * 2
    );
    doc.text(valueLines, marginX + cardPadding, overviewY + 4.5);

    overviewY += valueLines.length * 4.5 + 8;
  });

  y += cardHeight + 8;

  if (inspection.remarks?.trim()) {
    drawSectionHeading('Inspector Remarks');
    const remarksLines = doc.splitTextToSize(
      inspection.remarks.trim(),
      pageWidth - marginX * 2
    );
    const remarksHeight = remarksLines.length * lineHeight + 4;
    ensureSpace(remarksHeight);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);
    doc.text(remarksLines, marginX, y);
    y += remarksHeight + 4;
  }

  drawSectionHeading('Checklist Responses');

  if (!augmentedResponses.length) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9.5);
    doc.setTextColor(colors.muted.r, colors.muted.g, colors.muted.b);
    doc.text('No checklist responses were captured for this inspection.', marginX, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);
    y += 6;
  } else {
    const groupedByCategory = augmentedResponses.reduce((acc, current) => {
      const category = current.response.item?.category?.trim() || 'General';
      if (!acc.has(category)) {
        acc.set(category, []);
      }
      acc.get(category)!.push(current);
      return acc;
    }, new Map<string, AugmentedResponse[]>());

    groupedByCategory.forEach((categoryResponses, category) => {
      drawSubheading(category);
      renderResponseTable(categoryResponses);
    });
  }

  drawSectionHeading('Deviation Summary');
  const deviationRows = augmentedResponses.filter(entry => entry.isFail);
  if (!deviationRows.length) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(colors.success.r, colors.success.g, colors.success.b);
    doc.text('No deviations were recorded for this inspection.', marginX, y);
    doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);
    y += 6;
  } else {
    renderResponseTable(deviationRows);
  }

  const photoEntries = augmentedResponses.filter(entry => entry.response.photo_url);
  if (photoEntries.length) {
    drawSectionHeading('Photos & Evidence');
    photoEntries.forEach(entry => {
      const questionLabel =
        entry.response.item?.question?.trim() ?? `Checklist item ${entry.index + 1}`;
      const questionLines = doc.splitTextToSize(questionLabel, pageWidth - marginX * 2);
      const notesLines = entry.response.notes?.trim()
        ? doc.splitTextToSize(entry.response.notes, pageWidth - marginX * 2)
        : [];
      const resultLabel = (
        entry.response.condition ?? entry.normalizedCondition ?? 'N/A'
      )
        .toString()
        .toUpperCase();

      const imageDataUrl = responseImages.get(entry.key);
      let imageHeight = 0;
      const maxImageWidth = pageWidth - marginX * 2;
      let imageFormat: 'PNG' | 'JPEG' = 'JPEG';

      if (imageDataUrl) {
        imageFormat = imageDataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
        const { width: imgNativeWidth, height: imgNativeHeight } =
          doc.getImageProperties(imageDataUrl);
        const calculatedHeight = (imgNativeHeight * maxImageWidth) / imgNativeWidth || 60;
        imageHeight = Math.min(calculatedHeight, 90);
      }

      const blockHeight =
        questionLines.length * lineHeight +
        6 +
        (imageHeight ? imageHeight + 6 : 0) +
        (notesLines.length ? notesLines.length * lineHeight + 4 : 0);
      ensureSpace(blockHeight + 6);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(colors.primary.r, colors.primary.g, colors.primary.b);
      doc.text(questionLines, marginX, y);
      y += questionLines.length * lineHeight + 1.5;

      const resultColor = entry.isFail ? colors.danger : colors.success;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(resultColor.r, resultColor.g, resultColor.b);
      const deviationSuffix = entry.isFail
        ? ' (Deviation)'
        : entry.normalizedCondition === 'pass'
        ? ' (Compliant)'
        : '';
      doc.text(`Result: ${resultLabel}${deviationSuffix}`, marginX, y + 4);
      y += 8;
      doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);

      if (imageDataUrl) {
        doc.addImage(imageDataUrl, imageFormat, marginX, y, maxImageWidth, imageHeight);
        y += imageHeight + 4;
      } else if (entry.response.photo_url) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(colors.muted.r, colors.muted.g, colors.muted.b);
        const bucketInfo = entry.response.storage_bucket
          ? ` (${entry.response.storage_bucket})`
          : '';
        const fallbackLines = doc.splitTextToSize(
          `Photo URL${bucketInfo}: ${entry.response.photo_url}`,
          pageWidth - marginX * 2
        );
        doc.text(fallbackLines, marginX, y);
        y += fallbackLines.length * lineHeight + 2;
        doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);
      }

      if (notesLines.length) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);
        doc.text(notesLines, marginX, y);
        y += notesLines.length * lineHeight + 3;
      }

      doc.setDrawColor(colors.border.r, colors.border.g, colors.border.b);
      doc.setLineWidth(0.2);
      doc.line(marginX, y, pageWidth - marginX, y);
      y += 6;
    });
  }

  return doc;
};

export const createInspectionPdfBinary = async (
  inspection: InspectionDetail
): Promise<Uint8Array> => {
  const doc = await createInspectionPdfDocument(inspection);
  const arrayBuffer = doc.output('arraybuffer') as ArrayBuffer;
  return new Uint8Array(arrayBuffer);
};

export const createInspectionPdfBase64 = async (
  inspection: InspectionDetail
): Promise<{ base64: string; byteLength: number }> => {
  const doc = await createInspectionPdfDocument(inspection);
  const dataUri = doc.output('datauristring');
  const base64 = dataUri.split(',', 2)[1] ?? '';
  const padding = (base64.match(/=+$/) || [''])[0].length;
  const byteLength = Math.floor((base64.length * 3) / 4) - padding;
  return { base64, byteLength };
};
