import { getMappedRole, User, WorkflowRequest, WorkflowStatus, SalvageRequest, UserRole, getRolesMappingTo } from '../types';
import { supabase } from '../supabase/client';

const WEBHOOK_URL = 'https://hook.eu2.make.com/8txtgm1ou36nd0t1w3jrx891kpqy90mv';
const DENIAL_WEBHOOK_URL = 'https://hook.eu2.make.com/gew2qe8azxbg884131aa8ynd8gcycrmj';
const DISPATCH_WEBHOOK_URL = 'https://hook.eu2.make.com/av4hh2h3xnnnr18j5twe6eqwbslhu913';

export type WebhookActionType = 'APPROVAL' | 'DECLINE' | 'REJECTION' | 'ACCEPTANCE' | 'SALVAGE_DECISION';

type ApproverFieldKey = `approver${number}`;

type WebhookPayload = {
  actionType: WebhookActionType;
  requestNumber: string;
  previousStatus: WorkflowStatus;
  newStatus: WorkflowStatus;
  actor: {
    name: string;
    email: string;
    role: string;
  };
  comment?: string | null;
  timestamp: string;
  workflowId: string;
} & Partial<Record<ApproverFieldKey, string>>;

type DenialWebhookPayload = {
  requesterName: string;
  requesterEmail: string;
  subject: string;
  body: string;
};

type RecipientInfo = {
  email: string;
  name: string;
};

/**
 * Determines the recipients (email + name) of the next users in the workflow based on the new status.
 * Filters recipients by site and department assignments - users must be assigned to both the workflow's site AND department.
 * Admins with no site restrictions receive all notifications.
 * @param newStatus The status the workflow is transitioning TO.
 * @param request The workflow request object, must contain requester_id, projectCode, and department.
 * @returns A promise that resolves to an array of recipient info filtered by site and department access.
 */
async function getNextApprovers(
  newStatus: WorkflowStatus,
  request: Pick<WorkflowRequest, 'requester_id' | 'projectCode' | 'department'>
): Promise<RecipientInfo[]> {
  console.log('[getNextApprovers] New Status:', newStatus);
  console.log('[getNextApprovers] Request data:', {
    projectCode: request.projectCode,
    department: request.department,
    requester_id: request.requester_id
  });

  let targetRoles: UserRole[] = [];
  let targetUserId: string | null = null;

  switch (newStatus) {
    case WorkflowStatus.REQUEST_SUBMITTED:
      targetRoles = [UserRole.OperationsManager, UserRole.Admin].flatMap(getRolesMappingTo);
      break;
    case WorkflowStatus.STOCK_CONTROLLER_APPROVAL:
      targetRoles = [UserRole.StockController, UserRole.Admin].flatMap(getRolesMappingTo);
      break;
    case WorkflowStatus.AWAITING_EQUIP_MANAGER:
      targetRoles = [UserRole.EquipmentManager, UserRole.OperationsManager, UserRole.Admin].flatMap(getRolesMappingTo);
      break;
    case WorkflowStatus.AWAITING_PICKING:
      targetRoles = [UserRole.StockController, UserRole.Storeman, UserRole.OperationsManager, UserRole.Admin].flatMap(getRolesMappingTo);
      break;
    case WorkflowStatus.PICKED_AND_LOADED:
      targetRoles = [UserRole.Driver, UserRole.Security].flatMap(getRolesMappingTo);
      break;
    case WorkflowStatus.DISPATCHED:
    case WorkflowStatus.EPOD_CONFIRMED:
      targetUserId = request.requester_id;
      break;
    case WorkflowStatus.REQUEST_DECLINED:
      targetUserId = request.requester_id;
      break;
    case WorkflowStatus.REJECTED_AT_DELIVERY:
      targetRoles = [UserRole.StockController, UserRole.OperationsManager, UserRole.Admin].flatMap(getRolesMappingTo);
      break;
    case WorkflowStatus.COMPLETED:
      return [];
    default:
      return [];
  }

  if (targetUserId) {
    const { data, error } = await supabase
      .from('enprotec_users')
      .select('email, name')
      .eq('id', targetUserId)
      .eq('status', 'Active')
      .single();

    if (error || !data) {
      console.error(`Webhook: Could not find active user with ID ${targetUserId}`, error);
      return [];
    }
    return [{ email: data.email, name: data.name }];
  }

  if (targetRoles.length > 0) {
    // Query users with target roles and Active status, including site and department assignments
    const { data, error } = await supabase
      .from('enprotec_users')
      .select('email, name, sites, departments, role')
      .in('role', targetRoles)
      .eq('status', 'Active');

    if (error || !data) {
      console.error(`Webhook: Could not find active users for roles ${targetRoles.join(', ')}`, error);
      return [];
    }

    console.log(`[getNextApprovers] Query returned ${data.length} users with roles:`, targetRoles);

    // Filter by site and department assignments
    const filteredUsers = data.filter(user => {
      // Admin bypass - admins with no sites/departments get all notifications
      if (getMappedRole(user.role) === UserRole.Admin) {
        if (!user.sites || user.sites.length === 0) {
          console.log(`[getNextApprovers] ✓ Including Admin ${user.name} (no site restrictions)`);
          return true; // Admin with no site restrictions
        }
      }

      // Check site assignment (REQUIRED)
      const hasSiteAccess = user.sites && Array.isArray(user.sites) && user.sites.includes(request.projectCode);

      // Site access is mandatory
      if (!hasSiteAccess) {
        console.log(`[getNextApprovers] ✗ Excluding ${user.name}: No site access (has: ${user.sites?.join(', ') || 'none'}, needs: ${request.projectCode})`);
        return false;
      }

      // Check department assignment (OPTIONAL - only if user has departments configured)
      // If user has no departments configured, they get all notifications for their sites
      if (!user.departments || !Array.isArray(user.departments) || user.departments.length === 0) {
        console.log(`[getNextApprovers] ✓ Including ${user.name}: Has site access and no department restrictions`);
        return true; // User has site access and no department restrictions
      }

      // If user has departments configured, they must have access to this department
      const hasDepartmentAccess = user.departments.includes(request.department);
      if (hasDepartmentAccess) {
        console.log(`[getNextApprovers] ✓ Including ${user.name}: Has both site and department access`);
      } else {
        console.log(`[getNextApprovers] ✗ Excluding ${user.name}: Has site but no department access (has: ${user.departments.join(', ')}, needs: ${request.department})`);
      }
      return hasDepartmentAccess;
    });

    console.log(`[getNextApprovers] Filtered to ${filteredUsers.length} users with site/department access`);
    return filteredUsers.map(user => ({ email: user.email, name: user.name }));
  }

  return [];
}


/**
 * Determines the recipients for the next approvers in the salvage workflow.
 * @param newStatus The status the salvage request is transitioning TO.
 * @returns A promise that resolves to an array of recipient info.
 */
async function getNextApproversForSalvage(newStatus: WorkflowStatus): Promise<RecipientInfo[]> {
  let targetRoles: UserRole[] = [];

  switch (newStatus) {
    case WorkflowStatus.SALVAGE_TO_BE_REPAIRED:
    case WorkflowStatus.SALVAGE_TO_BE_SCRAPPED:
      targetRoles = [UserRole.EquipmentManager, UserRole.OperationsManager, UserRole.Admin].flatMap(getRolesMappingTo);
      break;
    case WorkflowStatus.SALVAGE_REPAIR_CONFIRMED:
    case WorkflowStatus.SALVAGE_SCRAP_CONFIRMED:
      targetRoles = [UserRole.StockController, UserRole.OperationsManager, UserRole.Admin].flatMap(getRolesMappingTo);
      break;
    default:
      return [];
  }

  if (targetRoles.length > 0) {
    const { data, error } = await supabase
      .from('enprotec_users')
      .select('email, name')
      .in('role', targetRoles)
      .eq('status', 'Active');
    if (error || !data) {
      console.error('Error fetching salvage user names/emails by role for webhook:', error);
      return [];
    }
    return data.map(user => ({ email: user.email, name: user.name }));
  }

  return [];
}


// A helper function to check if the object is a WorkflowRequest
function isWorkflowRequest(req: any): req is Pick<WorkflowRequest, 'id' | 'requestNumber' | 'currentStatus' | 'requester_id'> {
  return 'requestNumber' in req && 'currentStatus' in req && 'requester_id' in req;
}

/**
 * Generates workflow progress tracker HTML showing completed steps, current step, and next steps
 */
function generateWorkflowProgressHTML(newStatus: WorkflowStatus): string {
  const ENPROTEC_BLUE = '#0B5FAA';
  const ENPROTEC_GREEN = '#00A651';

  // Define workflow steps in order (Core Internal Flow)
  const workflowSteps = [
    { status: WorkflowStatus.REQUEST_SUBMITTED, label: 'Request Submitted', role: 'Requester' },
    { status: WorkflowStatus.AWAITING_OPS_MANAGER, label: 'Ops Manager Review', role: 'Ops Manager' },
    { status: WorkflowStatus.AWAITING_EQUIP_MANAGER, label: 'Equipment Manager Review', role: 'Equipment Manager' },
    { status: WorkflowStatus.AWAITING_PICKING, label: 'Picking', role: 'Stock Controller / Storeman' },
    { status: WorkflowStatus.PICKED_AND_LOADED, label: 'Picked & Loaded', role: 'Driver / Security' },
    { status: WorkflowStatus.DISPATCHED, label: 'In Transit', role: 'Driver' },
    { status: WorkflowStatus.EPOD_CONFIRMED, label: 'Delivered', role: 'Recipient' },
    { status: WorkflowStatus.COMPLETED, label: 'Completed', role: 'System' },
  ];

  // Find current step index
  const currentStepIndex = workflowSteps.findIndex(step => step.status === newStatus);

  // Generate step items
  const stepItems = workflowSteps.map((step, index) => {
    let icon = '';
    let color = '#94a3b8'; // Default grey
    let bgColor = '#f1f5f9';
    let fontWeight = '500';

    if (index < currentStepIndex || (newStatus === WorkflowStatus.COMPLETED && index === currentStepIndex)) {
      // Completed step
      icon = '✓';
      color = ENPROTEC_GREEN;
      bgColor = '#d1fae5';
      fontWeight = '600';
    } else if (index === currentStepIndex) {
      // Current step (pending)
      icon = '⏳';
      color = ENPROTEC_BLUE;
      bgColor = '#dbeafe';
      fontWeight = '700';
    } else {
      // Future step
      icon = '○';
      color = '#94a3b8';
      bgColor = '#f1f5f9';
      fontWeight = '500';
    }

    return `
        <tr>
          <td style="padding:8px 0;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
              <tr>
                <td style="width:40px;text-align:center;vertical-align:top;">
                  <div style="width:32px;height:32px;border-radius:50%;background:${bgColor};display:flex;align-items:center;justify-content:center;font-size:16px;color:${color};font-weight:700;margin:0 auto;">${icon}</div>
                </td>
                <td style="padding-left:12px;vertical-align:top;">
                  <div style="color:${color};font-size:14px;font-weight:${fontWeight};line-height:1.4;">${step.label}</div>
                  <div style="color:#64748b;font-size:12px;margin-top:2px;">${step.role}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>`;
  }).join('');

  // Determine next action message
  let nextActionMessage = '';
  if (newStatus === WorkflowStatus.COMPLETED) {
    nextActionMessage = 'This workflow has been completed. No further action required.';
  } else if (newStatus === WorkflowStatus.REQUEST_DECLINED || newStatus === WorkflowStatus.REJECTED_AT_DELIVERY) {
    nextActionMessage = 'This request has been declined. Please review the comments for details.';
  } else {
    const nextStepIndex = currentStepIndex + 1;
    if (nextStepIndex < workflowSteps.length) {
      const nextStep = workflowSteps[nextStepIndex];
      nextActionMessage = `<strong>Next Step:</strong> ${nextStep.label} by ${nextStep.role}`;
    } else {
      nextActionMessage = 'Workflow nearing completion.';
    }
  }

  return `
    <!-- Workflow Progress Card -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px 0;background:#fefce8;border-radius:12px;border:2px solid #fde047;">
      <tr>
        <td style="padding:20px;">
          <h3 style="margin:0 0 16px 0;color:#854d0e;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">📊 Workflow Progress</h3>

          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            ${stepItems}
          </table>

          ${nextActionMessage ? `
          <div style="margin-top:16px;padding:12px;background:#ffffff;border-radius:8px;border-left:4px solid ${ENPROTEC_BLUE};">
            <p style="margin:0;color:#1e293b;font-size:13px;line-height:1.6;">${nextActionMessage}</p>
          </div>
          ` : ''}
        </td>
      </tr>
    </table>`;
}

/**
 * Generates requested items table HTML
 */
function generateRequestedItemsHTML(workflow: WorkflowRequest): string {
  if (!workflow.items || workflow.items.length === 0) {
    return '';
  }

  const itemRows = workflow.items.map(item => `
        <tr style="border-bottom:1px solid #e2e8f0;">
            <td style="padding:12px 8px;color:#1e293b;font-size:13px;font-family:monospace;">${item.partNumber}</td>
            <td style="padding:12px 8px;color:#475569;font-size:13px;">${item.description}</td>
            <td style="padding:12px 8px;color:#1e293b;font-size:13px;font-weight:600;text-align:center;">${item.quantityRequested}</td>
            <td style="padding:12px 8px;color:#64748b;font-size:13px;text-align:center;">${item.quantityOnHand ?? 'N/A'}</td>
        </tr>
    `).join('');

  return `
    <!-- Requested Items Card -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px 0;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;">
        <tr>
            <td style="padding:20px;">
                <h3 style="margin:0 0 16px 0;color:#1e293b;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">📦 Requested Items</h3>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
                    <thead>
                        <tr style="background:#e2e8f0;">
                            <th style="padding:10px 8px;color:#475569;font-size:12px;font-weight:700;text-align:left;text-transform:uppercase;">Part Number</th>
                            <th style="padding:10px 8px;color:#475569;font-size:12px;font-weight:700;text-align:left;text-transform:uppercase;">Description</th>
                            <th style="padding:10px 8px;color:#475569;font-size:12px;font-weight:700;text-align:center;text-transform:uppercase;">Qty Requested</th>
                            <th style="padding:10px 8px;color:#475569;font-size:12px;font-weight:700;text-align:center;text-transform:uppercase;">Stock on Hand</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemRows}
                    </tbody>
                </table>
            </td>
        </tr>
    </table>
    `;
}

/**
 * Generates HTML email body for workflow status changes
 */
function generateWorkflowEmailHTML(
  requestNumber: string,
  actionType: WebhookActionType,
  previousStatus: WorkflowStatus,
  newStatus: WorkflowStatus,
  actor: { name: string; email: string; role: string },
  comment?: string | null,
  workflowData?: Partial<WorkflowRequest>
): string {
  const safeComment = comment && comment.trim().length > 0 ? comment.trim() : 'No additional comments provided.';

  // Enprotec brand colors from logo: Blue primary, Green accent, Dark grey
  const ENPROTEC_BLUE = '#0B5FAA'; // Primary blue from logo
  const ENPROTEC_GREEN = '#00A651'; // Green accent from logo
  const ENPROTEC_DARK = '#2D2D2D';
  const ENPROTEC_LIGHT_BLUE = '#1E7BC5';

  let actionText = '';
  let actionColor = ENPROTEC_BLUE;
  let headerBg = `linear-gradient(135deg, ${ENPROTEC_BLUE} 0%, ${ENPROTEC_LIGHT_BLUE} 100%)`;
  let statusBadgeBg = '#e0f2fe';
  let statusBadgeColor = '#075985';

  switch (actionType) {
    case 'APPROVAL':
      actionText = 'Approved';
      actionColor = ENPROTEC_GREEN;
      headerBg = `linear-gradient(135deg, ${ENPROTEC_BLUE} 0%, ${ENPROTEC_LIGHT_BLUE} 100%)`;
      statusBadgeBg = '#d1fae5';
      statusBadgeColor = '#065f46';
      break;
    case 'DECLINE':
      actionText = 'Declined';
      actionColor = '#ef4444';
      headerBg = `linear-gradient(135deg, ${ENPROTEC_DARK} 0%, #3d3d3d 100%)`;
      statusBadgeBg = '#fee2e2';
      statusBadgeColor = '#991b1b';
      break;
    case 'REJECTION':
      actionText = 'Rejected';
      actionColor = '#ef4444';
      headerBg = `linear-gradient(135deg, ${ENPROTEC_DARK} 0%, #3d3d3d 100%)`;
      statusBadgeBg = '#fed7aa';
      statusBadgeColor = '#9a3412';
      break;
    case 'ACCEPTANCE':
      actionText = 'Accepted';
      actionColor = ENPROTEC_GREEN;
      headerBg = `linear-gradient(135deg, ${ENPROTEC_BLUE} 0%, ${ENPROTEC_LIGHT_BLUE} 100%)`;
      statusBadgeBg = '#d1fae5';
      statusBadgeColor = '#065f46';
      break;
    case 'SALVAGE_DECISION':
      actionText = 'Updated';
      actionColor = ENPROTEC_BLUE;
      headerBg = `linear-gradient(135deg, ${ENPROTEC_BLUE} 0%, ${ENPROTEC_LIGHT_BLUE} 100%)`;
      statusBadgeBg = '#e0f2fe';
      statusBadgeColor = '#075985';
      break;
  }

  return `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${requestNumber} - ${actionText}</title>
  </head>
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:40px 20px;">
      <tr>
        <td align="center">
          <!-- Main Container -->
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1),0 2px 4px -1px rgba(0,0,0,0.06);">

            <!-- Header with Enprotec Branding -->
            <tr>
              <td style="background:${headerBg};padding:32px 24px;text-align:center;">
                <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:-0.5px;">ENPROTEC</h1>
                <p style="margin:8px 0 0 0;color:#ffffff;font-size:14px;opacity:0.95;font-weight:500;">Workflow Management System</p>
              </td>
            </tr>

            <!-- Action Required Alert (only for pending approvals) -->
            ${newStatus === 'Awaiting Ops Manager' || newStatus === 'Awaiting Equip. Manager' || newStatus === 'Awaiting Stock Controller' || newStatus === 'Manager Approval' ? `
            <tr>
              <td style="padding:24px 32px 16px 32px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:linear-gradient(135deg, ${ENPROTEC_BLUE} 0%, ${ENPROTEC_LIGHT_BLUE} 100%);border-radius:12px;border:3px solid ${ENPROTEC_BLUE};">
                  <tr>
                    <td style="padding:20px;text-align:center;">
                      <h2 style="margin:0 0 8px 0;color:#ffffff;font-size:24px;font-weight:700;">⚠️ ACTION REQUIRED</h2>
                      <p style="margin:0;color:#ffffff;font-size:16px;font-weight:500;opacity:0.95;">You have a pending approval waiting for your review</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            ` : ''}

            <!-- Status Badge -->
            <tr>
              <td style="padding:24px 24px 0 24px;text-align:center;">
                <div style="display:inline-block;background:${statusBadgeBg};color:${statusBadgeColor};padding:8px 20px;border-radius:20px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">
                  ${actionText}
                </div>
              </td>
            </tr>

            <!-- Main Content -->
            <tr>
              <td style="padding:24px 32px;">
                <h2 style="margin:0 0 16px 0;color:#1e293b;font-size:22px;font-weight:600;">Request ${requestNumber}</h2>
                <p style="margin:0 0 24px 0;color:#475569;font-size:15px;line-height:1.6;">
                  ${newStatus === 'Awaiting Ops Manager' || newStatus === 'Awaiting Equip. Manager' || newStatus === 'Awaiting Stock Controller' || newStatus === 'Manager Approval'
      ? `<strong style="color:${ENPROTEC_BLUE};">This request requires your approval.</strong> Please review the details below and take action in the system.`
      : `This request has been <strong style="color:${actionColor};">${actionText.toLowerCase()}</strong> by <strong>${actor.name}</strong> (${actor.role}).`
    }
                </p>

                ${workflowData ? `
                <!-- Request Details Card -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px 0;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;">
                  <tr>
                    <td style="padding:20px;">
                      <h3 style="margin:0 0 12px 0;color:#1e293b;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">📋 Request Details</h3>
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                        ${workflowData.projectCode ? `
                        <tr>
                          <td style="padding:6px 0;color:#64748b;font-size:13px;width:40%;">Site/Project:</td>
                          <td style="padding:6px 0;color:#1e293b;font-size:13px;font-weight:600;">${workflowData.projectCode}</td>
                        </tr>` : ''}
                        ${workflowData.department ? `
                        <tr>
                          <td style="padding:6px 0;color:#64748b;font-size:13px;width:40%;">Department:</td>
                          <td style="padding:6px 0;color:#1e293b;font-size:13px;font-weight:600;">${workflowData.department}</td>
                        </tr>` : ''}
                        ${workflowData.priority ? `
                        <tr>
                          <td style="padding:6px 0;color:#64748b;font-size:13px;width:40%;">Priority:</td>
                          <td style="padding:6px 0;">
                            <span style="background:${workflowData.priority === 'Critical' ? '#fee2e2' : workflowData.priority === 'High' ? '#fed7aa' : workflowData.priority === 'Medium' ? '#fef3c7' : '#d1fae5'};color:${workflowData.priority === 'Critical' ? '#991b1b' : workflowData.priority === 'High' ? '#9a3412' : workflowData.priority === 'Medium' ? '#92400e' : '#065f46'};padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600;">${workflowData.priority}</span>
                          </td>
                        </tr>` : ''}
                        ${workflowData.requester ? `
                        <tr>
                          <td style="padding:6px 0;color:#64748b;font-size:13px;width:40%;">Requested By:</td>
                          <td style="padding:6px 0;color:#1e293b;font-size:13px;font-weight:600;">${workflowData.requester}</td>
                        </tr>` : ''}
                      </table>
                    </td>
                  </tr>
                </table>

                <!-- Status Change Card -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px 0;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;">
                  <tr>
                    <td style="padding:20px;">
                      <h3 style="margin:0 0 12px 0;color:#1e293b;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">🔄 Status Update</h3>
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                        <tr>
                          <td style="padding:6px 0;color:#64748b;font-size:13px;width:40%;">Previous Status:</td>
                          <td style="padding:6px 0;color:#64748b;font-size:13px;font-weight:600;">${previousStatus}</td>
                        </tr>
                        <tr>
                          <td style="padding:6px 0;color:#64748b;font-size:13px;width:40%;">New Status:</td>
                          <td style="padding:6px 0;color:${actionColor};font-size:13px;font-weight:700;">${newStatus}</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>

                <!-- Action Taken By Card -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px 0;background:#f0f9ff;border-radius:12px;border:1px solid #bae6fd;">
                  <tr>
                    <td style="padding:20px;">
                      <h3 style="margin:0 0 12px 0;color:#075985;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">👤 Action Taken By</h3>
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                        <tr>
                          <td style="padding:6px 0;color:#0369a1;font-size:13px;width:40%;">Name:</td>
                          <td style="padding:6px 0;color:#0c4a6e;font-size:13px;font-weight:600;">${actor.name}</td>
                        </tr>
                        <tr>
                          <td style="padding:6px 0;color:#0369a1;font-size:13px;width:40%;">Email:</td>
                          <td style="padding:6px 0;color:#0c4a6e;font-size:13px;font-weight:600;">${actor.email}</td>
                        </tr>
                        <tr>
                          <td style="padding:6px 0;color:#0369a1;font-size:13px;width:40%;">Role:</td>
                          <td style="padding:6px 0;color:#0c4a6e;font-size:13px;font-weight:600;">${actor.role}</td>
                        </tr>
                        <tr>
                          <td style="padding:6px 0;color:#0369a1;font-size:13px;width:40%;">Timestamp:</td>
                          <td style="padding:6px 0;color:#0c4a6e;font-size:13px;font-weight:600;">${new Date().toLocaleString('en-ZA', { dateStyle: 'long', timeStyle: 'short' })}</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>

                ${workflowData ? generateRequestedItemsHTML(workflowData as WorkflowRequest) : ''}

                <!-- Workflow Progress Card -->
                ${generateWorkflowProgressHTML(newStatus)}
                ` : `
                <!-- Simple Status Change -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px 0;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;">
                  <tr>
                    <td style="padding:20px;">
                      <h3 style="margin:0 0 12px 0;color:#1e293b;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">🔄 Status Update</h3>
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                        <tr>
                          <td style="padding:6px 0;color:#64748b;font-size:13px;width:40%;">Previous Status:</td>
                          <td style="padding:6px 0;color:#64748b;font-size:13px;font-weight:600;">${previousStatus}</td>
                        </tr>
                        <tr>
                          <td style="padding:6px 0;color:#64748b;font-size:13px;width:40%;">New Status:</td>
                          <td style="padding:6px 0;color:${actionColor};font-size:13px;font-weight:700;">${newStatus}</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>

                <!-- Action Taken By Card -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px 0;background:#f0f9ff;border-radius:12px;border:1px solid #bae6fd;">
                  <tr>
                    <td style="padding:20px;">
                      <h3 style="margin:0 0 12px 0;color:#075985;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">👤 Action Taken By</h3>
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                        <tr>
                          <td style="padding:6px 0;color:#0369a1;font-size:13px;width:40%;">Name:</td>
                          <td style="padding:6px 0;color:#0c4a6e;font-size:13px;font-weight:600;">${actor.name}</td>
                        </tr>
                        <tr>
                          <td style="padding:6px 0;color:#0369a1;font-size:13px;width:40%;">Email:</td>
                          <td style="padding:6px 0;color:#0c4a6e;font-size:13px;font-weight:600;">${actor.email}</td>
                        </tr>
                        <tr>
                          <td style="padding:6px 0;color:#0369a1;font-size:13px;width:40%;">Role:</td>
                          <td style="padding:6px 0;color:#0c4a6e;font-size:13px;font-weight:600;">${actor.role}</td>
                        </tr>
                        <tr>
                          <td style="padding:6px 0;color:#0369a1;font-size:13px;width:40%;">Timestamp:</td>
                          <td style="padding:6px 0;color:#0c4a6e;font-size:13px;font-weight:600;">${new Date().toLocaleString('en-ZA', { dateStyle: 'long', timeStyle: 'short' })}</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>

                ${workflowData ? generateRequestedItemsHTML(workflowData as WorkflowRequest) : ''}

                <!-- Workflow Progress Card -->
                ${generateWorkflowProgressHTML(newStatus)}
                `}

                ${comment && comment.trim().length > 0 ? `
                <!-- Comments Card -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px 0;background:#fffbeb;border-radius:12px;border:1px solid #fde68a;">
                  <tr>
                    <td style="padding:20px;">
                      <h3 style="margin:0 0 12px 0;color:#92400e;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">💬 Comments</h3>
                      <p style="margin:0;color:#78350f;font-size:14px;line-height:1.6;font-style:italic;">"${safeComment}"</p>
                    </td>
                  </tr>
                </table>
                ` : ''}
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:24px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;">
                <p style="margin:0 0 8px 0;color:#475569;font-size:12px;line-height:1.5;">
                  This is an automated notification from <strong>Enprotec Workflow Management System</strong>.
                </p>
                <p style="margin:0;color:#94a3b8;font-size:11px;">
                  Please do not reply to this email. For support, contact your system administrator.
                </p>
              </td>
            </tr>
          </table>

          <!-- Bottom Spacing -->
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="margin-top:20px;">
            <tr>
              <td style="text-align:center;padding:0 20px;">
                <p style="margin:0;color:#94a3b8;font-size:11px;">
                  © ${new Date().getFullYear()} Enprotec. All rights reserved.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`.trim();
}

/**
 * Generates HTML email body for dispatch notifications
 */
function generateDispatchEmailHTML(request: WorkflowRequest, dispatchedBy: User): string {
  const itemsHTML = request.items.map((item, index) => `
        <tr style="border-bottom:${index < request.items.length - 1 ? '1px solid #e2e8f0' : 'none'};">
          <td style="padding:12px 0;color:#1e293b;font-size:13px;font-family:monospace;font-weight:600;">${item.partNumber}</td>
          <td style="padding:12px 0;color:#475569;font-size:13px;">${item.description}</td>
          <td style="padding:12px 0;color:#1e293b;font-size:13px;text-align:center;font-weight:600;">${item.quantityRequested}</td>
        </tr>
    `).join('');

  return `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${request.requestNumber} - Dispatched</title>
  </head>
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:40px 20px;">
      <tr>
        <td align="center">
          <!-- Main Container -->
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1),0 2px 4px -1px rgba(0,0,0,0.06);">

            <!-- Header with Enprotec Branding (Dispatch) -->
            <tr>
              <td style="background:linear-gradient(135deg, #0B5FAA 0%, #1E7BC5 100%);padding:32px 24px;text-align:center;">
                <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:-0.5px;">ENPROTEC</h1>
                <p style="margin:8px 0 0 0;color:#ffffff;font-size:14px;opacity:0.95;font-weight:500;">Workflow Management System</p>
              </td>
            </tr>

            <!-- Dispatch Icon/Badge -->
            <tr>
              <td style="padding:24px 24px 0 24px;text-align:center;">
                <div style="display:inline-block;background:#d1fae5;color:#065f46;padding:8px 20px;border-radius:20px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">
                  🚚 Dispatched
                </div>
              </td>
            </tr>

            <!-- Main Content -->
            <tr>
              <td style="padding:24px 32px;">
                <h2 style="margin:0 0 16px 0;color:#1e293b;font-size:22px;font-weight:600;">Request ${request.requestNumber}</h2>
                <p style="margin:0 0 24px 0;color:#475569;font-size:15px;line-height:1.6;">
                  Great news! Your order has been <strong style="color:#10b981;">dispatched</strong> and is on its way to you.
                </p>

                <!-- Delivery Information Card -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px 0;background:#ecfdf5;border-radius:12px;border:1px solid #a7f3d0;">
                  <tr>
                    <td style="padding:20px;">
                      <h3 style="margin:0 0 16px 0;color:#065f46;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">🚛 Delivery Information</h3>
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                        <tr>
                          <td style="padding:6px 0;color:#047857;font-size:13px;width:40%;">Driver:</td>
                          <td style="padding:6px 0;color:#064e3b;font-size:13px;font-weight:600;">${request.driverName || 'Not specified'}</td>
                        </tr>
                        <tr>
                          <td style="padding:6px 0;color:#047857;font-size:13px;width:40%;">Vehicle Reg:</td>
                          <td style="padding:6px 0;color:#064e3b;font-size:13px;font-weight:600;">${request.vehicleRegistration || 'Not specified'}</td>
                        </tr>
                        <tr>
                          <td style="padding:6px 0;color:#047857;font-size:13px;width:40%;">Destination:</td>
                          <td style="padding:6px 0;color:#064e3b;font-size:13px;font-weight:600;">${request.projectCode}</td>
                        </tr>
                        <tr>
                          <td style="padding:6px 0;color:#047857;font-size:13px;width:40%;">Department:</td>
                          <td style="padding:6px 0;color:#064e3b;font-size:13px;font-weight:600;">${request.department}</td>
                        </tr>
                        <tr>
                          <td style="padding:6px 0;color:#047857;font-size:13px;width:40%;">Dispatched By:</td>
                          <td style="padding:6px 0;color:#064e3b;font-size:13px;font-weight:600;">${dispatchedBy.name} (${dispatchedBy.role})</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>

                <!-- Items Table -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px 0;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
                  <tr>
                    <td style="padding:20px 20px 12px 20px;">
                      <h3 style="margin:0 0 16px 0;color:#1e293b;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">📦 Items Being Delivered</h3>
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                        <thead>
                          <tr style="border-bottom:2px solid #cbd5e1;">
                            <th style="padding:8px 0;text-align:left;color:#64748b;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Part Number</th>
                            <th style="padding:8px 0;text-align:left;color:#64748b;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Description</th>
                            <th style="padding:8px 0;text-align:center;color:#64748b;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Qty</th>
                          </tr>
                        </thead>
                        <tbody>
                          ${itemsHTML}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                </table>

                <!-- Priority Badge -->
                ${request.priority ? `
                <div style="text-align:center;margin:0 0 20px 0;">
                  <span style="background:${request.priority === 'Critical' ? '#fee2e2' : request.priority === 'High' ? '#fed7aa' : request.priority === 'Medium' ? '#fef3c7' : '#d1fae5'};color:${request.priority === 'Critical' ? '#991b1b' : request.priority === 'High' ? '#9a3412' : request.priority === 'Medium' ? '#92400e' : '#065f46'};padding:6px 16px;border-radius:20px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">
                    ${request.priority} Priority
                  </span>
                </div>
                ` : ''}
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:24px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;">
                <p style="margin:0 0 8px 0;color:#475569;font-size:12px;line-height:1.5;">
                  This is an automated notification from <strong>Enprotec Workflow Management System</strong>.
                </p>
                <p style="margin:0;color:#94a3b8;font-size:11px;">
                  Please do not reply to this email. For support, contact your system administrator.
                </p>
              </td>
            </tr>
          </table>

          <!-- Bottom Spacing -->
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="margin-top:20px;">
            <tr>
              <td style="text-align:center;padding:0 20px;">
                <p style="margin:0;color:#94a3b8;font-size:11px;">
                  © ${new Date().getFullYear()} Enprotec. All rights reserved.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`.trim();
}

export const sendApprovalWebhook = async (
  actionType: WebhookActionType,
  request: Pick<WorkflowRequest, 'id' | 'requestNumber' | 'currentStatus' | 'requester_id'> | SalvageRequest,
  newStatus: WorkflowStatus,
  user: User,
  comment?: string | null
): Promise<void> => {

  if (import.meta.env.VITE_APP_ENV === 'dev') {
    console.log('[Webhook] Dev environment — approval webhook suppressed.');
    return;
  }

  let recipients: RecipientInfo[] = [];
  if (isWorkflowRequest(request)) {
    recipients = await getNextApprovers(newStatus, request);
  } else {
    recipients = await getNextApproversForSalvage(newStatus);
  }

  console.log(`[Webhook] Action: ${actionType}, New Status: ${newStatus}, Recipients found: ${recipients.length}`);
  if (recipients.length > 0) {
    console.log('[Webhook] Recipients:', recipients.map(r => `${r.name} (${r.email})`).join(', '));
  } else {
    console.warn('[Webhook] WARNING: No recipients found for this workflow notification!');
  }

  const requestNumber = isWorkflowRequest(request) ? request.requestNumber : `SALVAGE-${request.partNumber}`;
  const previousStatus = isWorkflowRequest(request) ? request.currentStatus : request.status;

  // Generate HTML email body
  const bodyHTML = generateWorkflowEmailHTML(
    requestNumber,
    actionType,
    previousStatus,
    newStatus,
    {
      name: user.name,
      email: user.email,
      role: user.role,
    },
    comment,
    isWorkflowRequest(request) ? request as Partial<WorkflowRequest> : undefined
  );

  // Generate subject line
  let subjectAction = '';
  switch (actionType) {
    case 'APPROVAL': subjectAction = 'Approved'; break;
    case 'DECLINE': subjectAction = 'Declined'; break;
    case 'REJECTION': subjectAction = 'Rejected'; break;
    case 'ACCEPTANCE': subjectAction = 'Accepted'; break;
    case 'SALVAGE_DECISION': subjectAction = 'Updated'; break;
  }
  const subject = `${requestNumber} - ${subjectAction}`;

  // Build individual recipient fields (email1, name1, email2, name2, etc.)
  // Send actual recipients in first N slots, then send ALL recipients as semicolon-separated string
  const recipientFields: Record<string, string> = {};

  // Populate individual fields for first 8 recipients
  for (let i = 1; i <= 8; i++) {
    const recipient = recipients[i - 1];
    recipientFields[`email${i}`] = recipient?.email || '';
    recipientFields[`name${i}`] = recipient?.name || '';
  }

  // Add a combined "to" field with all emails separated by semicolons for Outlook module
  const allEmails = recipients.map(r => r.email).join(';');
  const recipientCount = recipients.length;

  const payload = {
    subject,
    body: bodyHTML,
    to: allEmails,  // All recipients in one field for Outlook Send Email module
    recipient_count: recipientCount,
    ...recipientFields,
  };

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Webhook failed with status ${response.status}: ${errorText}`);
    } else {
      console.log(`Webhook for ${actionType} on ${requestNumber} sent successfully.`);
    }
  } catch (error) {
    console.error('Error sending webhook notification:', error);
  }
};

export const sendDenialWebhook = async (request: WorkflowRequest, comment: string | null): Promise<void> => {
  if (import.meta.env.VITE_APP_ENV === 'dev') {
    console.log('[Webhook] Dev environment — denial webhook suppressed.');
    return;
  }
  try {
    const { data: requester, error } = await supabase
      .from('enprotec_users')
      .select('email, name')
      .eq('id', request.requester_id)
      .single();

    if (error || !requester?.email || !requester?.name) {
      console.error('Denial webhook: could not load requester email/name', error);
      return;
    }

    const subject = `${request.requestNumber} - Denied`;
    const safeComment = comment && comment.trim().length > 0 ? comment.trim() : 'No additional comments were provided.';
    const body = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${subject}</title>
  </head>
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:40px 20px;">
      <tr>
        <td align="center">
          <!-- Main Container -->
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1),0 2px 4px -1px rgba(0,0,0,0.06);">

            <!-- Header with Enprotec Branding (Denial) -->
            <tr>
              <td style="background:linear-gradient(135deg, #2D2D2D 0%, #3d3d3d 100%);padding:32px 24px;text-align:center;">
                <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:-0.5px;">ENPROTEC</h1>
                <p style="margin:8px 0 0 0;color:#ffffff;font-size:14px;opacity:0.95;font-weight:500;">Workflow Management System</p>
              </td>
            </tr>

            <!-- Denial Badge -->
            <tr>
              <td style="padding:24px 24px 0 24px;text-align:center;">
                <div style="display:inline-block;background:#fee2e2;color:#991b1b;padding:8px 20px;border-radius:20px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">
                  ❌ Request Denied
                </div>
              </td>
            </tr>

            <!-- Main Content -->
            <tr>
              <td style="padding:24px 32px;">
                <p style="margin:0 0 8px 0;color:#1e293b;font-size:16px;">Hi <strong>${requester.name}</strong>,</p>
                <p style="margin:0 0 24px 0;color:#475569;font-size:15px;line-height:1.6;">
                  We regret to inform you that your request <strong>${request.requestNumber}</strong> for <strong>${request.projectCode}</strong> has been <strong style="color:#dc2626;">denied</strong>.
                </p>

                <!-- Denial Reason Card -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px 0;background:#fef2f2;border-radius:12px;border:1px solid #fecaca;">
                  <tr>
                    <td style="padding:20px;">
                      <h3 style="margin:0 0 12px 0;color:#991b1b;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">❗ Reason for Denial</h3>
                      <p style="margin:0;color:#7f1d1d;font-size:14px;line-height:1.6;font-style:italic;">"${safeComment}"</p>
                    </td>
                  </tr>
                </table>

                <!-- Request Summary Card -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px 0;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;">
                  <tr>
                    <td style="padding:20px;">
                      <h3 style="margin:0 0 16px 0;color:#1e293b;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">📋 Request Summary</h3>
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                        <tr>
                          <td style="padding:6px 0;color:#64748b;font-size:13px;width:40%;">Request Number:</td>
                          <td style="padding:6px 0;color:#1e293b;font-size:13px;font-weight:600;">${request.requestNumber}</td>
                        </tr>
                        <tr>
                          <td style="padding:6px 0;color:#64748b;font-size:13px;width:40%;">Site/Project:</td>
                          <td style="padding:6px 0;color:#1e293b;font-size:13px;font-weight:600;">${request.projectCode || 'N/A'}</td>
                        </tr>
                        <tr>
                          <td style="padding:6px 0;color:#64748b;font-size:13px;width:40%;">Department/Store:</td>
                          <td style="padding:6px 0;color:#1e293b;font-size:13px;font-weight:600;">${request.department}</td>
                        </tr>
                        <tr>
                          <td style="padding:6px 0;color:#64748b;font-size:13px;width:40%;">Priority:</td>
                          <td style="padding:6px 0;">
                            <span style="background:${request.priority === 'Critical' ? '#fee2e2' : request.priority === 'High' ? '#fed7aa' : request.priority === 'Medium' ? '#fef3c7' : '#d1fae5'};color:${request.priority === 'Critical' ? '#991b1b' : request.priority === 'High' ? '#9a3412' : request.priority === 'Medium' ? '#92400e' : '#065f46'};padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600;">${request.priority}</span>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding:6px 0;color:#64748b;font-size:13px;width:40%;">Status:</td>
                          <td style="padding:6px 0;">
                            <span style="background:#fee2e2;color:#991b1b;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600;">Denied</span>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>

                ${generateRequestedItemsHTML(request)}

                <p style="margin:0;color:#475569;font-size:13px;line-height:1.6;">
                  If you have questions about this decision, please contact your supervisor or the approving manager.
                </p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:24px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;">
                <p style="margin:0 0 8px 0;color:#475569;font-size:12px;line-height:1.5;">
                  This is an automated notification from <strong>Enprotec Workflow Management System</strong>.
                </p>
                <p style="margin:0;color:#94a3b8;font-size:11px;">
                  Please do not reply to this email. For support, contact your system administrator.
                </p>
              </td>
            </tr>
          </table>

          <!-- Bottom Spacing -->
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="margin-top:20px;">
            <tr>
              <td style="text-align:center;padding:0 20px;">
                <p style="margin:0;color:#94a3b8;font-size:11px;">
                  © ${new Date().getFullYear()} Enprotec. All rights reserved.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`.trim();

    // Build individual recipient fields (email1, name1, email2, name2, etc.)
    // Denial only goes to requester
    const recipientFields: Record<string, string> = {};
    for (let i = 1; i <= 8; i++) {
      if (i === 1) {
        recipientFields[`email${i}`] = requester.email;
        recipientFields[`name${i}`] = requester.name;
      } else {
        recipientFields[`email${i}`] = '';
        recipientFields[`name${i}`] = '';
      }
    }

    const payload = {
      subject,
      body,
      to: requester.email,  // Single recipient for Outlook module
      recipient_count: 1,
      ...recipientFields,
    };

    const response = await fetch(DENIAL_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(`Denial webhook failed with status ${response.status}`);
    } else {
      console.log(`Denial webhook for ${request.requestNumber} sent successfully.`);
    }
  } catch (err) {
    console.error('Error sending denial webhook:', err);
  }
};

export const sendDispatchWebhook = async (request: WorkflowRequest, user: User): Promise<void> => {
  if (import.meta.env.VITE_APP_ENV === 'dev') {
    console.log('[Webhook] Dev environment — dispatch webhook suppressed.');
    return;
  }
  try {
    // Get all workflow participants - everyone involved in the workflow for this site/department
    const allRoles: UserRole[] = [
      UserRole.OperationsManager,
      UserRole.StockController,
      UserRole.EquipmentManager,
      UserRole.Storeman,
      UserRole.Driver,
      UserRole.Security,
      UserRole.Admin
    ];

    const { data: allUsers, error: usersError } = await supabase
      .from('enprotec_users')
      .select('email, name, sites, departments, role, id')
      .in('role', allRoles)
      .eq('status', 'Active');

    if (usersError || !allUsers) {
      console.error('Dispatch webhook: could not load workflow participants', usersError);
      return;
    }

    // Filter by site and department assignments + include original requester
    const participants = allUsers.filter(participant => {
      // Always include the original requester
      if (participant.id === request.requester_id) {
        return true;
      }

      // Admin bypass - admins with no sites/departments get all notifications
      if (participant.role === UserRole.Admin) {
        if (!participant.sites || participant.sites.length === 0) {
          return true;
        }
      }

      // Check site and department access
      const hasSiteAccess = participant.sites && Array.isArray(participant.sites) && participant.sites.includes(request.projectCode);
      const hasDepartmentAccess = participant.departments && Array.isArray(participant.departments) && participant.departments.includes(request.department);

      return hasSiteAccess && hasDepartmentAccess;
    });

    if (participants.length === 0) {
      console.warn('Dispatch webhook: no participants found for this workflow');
      return;
    }

    // Generate HTML email body
    const bodyHTML = generateDispatchEmailHTML(request, user);

    // Subject line
    const subject = `${request.requestNumber} - Items Dispatched`;

    // Build individual recipient fields (email1, name1, email2, name2, etc.)
    // Send actual participants in first N slots, blank strings for unused slots
    const recipientFields: Record<string, string> = {};

    // Populate individual fields for first 8 participants
    for (let i = 1; i <= 8; i++) {
      const participant = participants[i - 1];
      recipientFields[`email${i}`] = participant?.email || '';
      recipientFields[`name${i}`] = participant?.name || '';
    }

    // Add a combined "to" field with all emails separated by semicolons for Outlook module
    const allEmails = participants.map(p => p.email).join(';');
    const participantCount = participants.length;

    const payload = {
      subject,
      body: bodyHTML,
      to: allEmails,  // All participants in one field for Outlook Send Email module
      recipient_count: participantCount,
      ...recipientFields,
    };

    const response = await fetch(DISPATCH_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Dispatch webhook failed with status ${response.status}: ${errorText}`);
    } else {
      console.log(`Dispatch webhook for ${request.requestNumber} sent successfully to ${participants.length} recipient(s).`);
    }
  } catch (err) {
    console.error('Error sending dispatch webhook:', err);
  }
};
