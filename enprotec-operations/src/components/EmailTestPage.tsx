import React, { useState, useEffect } from 'react';
import { WorkflowStatus, WorkflowRequest, User } from '../../types';
import { supabase } from '../../supabase/client';

// Test webhook URLs
const WEBHOOK_URL = 'https://hook.eu2.make.com/8txtgm1ou36nd0t1w3jrx891kpqy90mv';
const DENIAL_WEBHOOK_URL = 'https://hook.eu2.make.com/gew2qe8azxbg884131aa8ynd8gcycrmj';
const DISPATCH_WEBHOOK_URL = 'https://hook.eu2.make.com/av4hh2h3xnnnr18j5twe6eqwbslhu913';

// Test email addresses - realistic list to simulate multiple recipients
const TEST_RECIPIENTS = [
    { email: 'rahul.nepaulawa@gmail.com', name: 'Rahul Nepaulawa' },
    { email: 'john.opsmanager@test.com', name: 'John Smith' },
    { email: 'mitzi.stock@test.com', name: 'Mitzi Stock' },
];

const EmailTestPage: React.FC = () => {
    const [status, setStatus] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const [sampleWorkflow, setSampleWorkflow] = useState<WorkflowRequest | null>(null);
    const [currentUser, setCurrentUser] = useState<User | null>(null);

    // Fetch a real workflow from the database for testing
    useEffect(() => {
        const fetchSampleData = async () => {
            try {
                // Fetch the most recent workflow request from the VIEW (not the raw table)
                const { data: workflows, error: workflowError } = await supabase
                    .from('enprotec_workflows_view')
                    .select('*')
                    .order('createdAt', { ascending: false })
                    .limit(1)
                    .single();

                if (!workflowError && workflows) {
                    setSampleWorkflow(workflows as WorkflowRequest);
                }

                // Fetch current user
                const { data: { user: authUser } } = await supabase.auth.getUser();
                if (authUser) {
                    const { data: userData } = await supabase
                        .from('enprotec_users')
                        .select('*')
                        .eq('id', authUser.id)
                        .single();

                    if (userData) {
                        setCurrentUser(userData as User);
                    }
                }
            } catch (err) {
                console.error('Error fetching sample data:', err);
            }
        };

        fetchSampleData();
    }, []);

    /**
     * Generates workflow progress tracker HTML - EXACT COPY FROM PRODUCTION
     */
    const generateWorkflowProgressHTML = (newStatus: WorkflowStatus): string => {
        const ENPROTEC_BLUE = '#0B5FAA';
        const ENPROTEC_GREEN = '#00A651';

        // Define workflow steps in order
        const workflowSteps = [
            { status: WorkflowStatus.REQUEST_SUBMITTED, label: 'Request Submitted', role: 'Requester' },
            { status: WorkflowStatus.AWAITING_OPS_MANAGER, label: 'Ops Manager Review', role: 'Ops Manager' },
            { status: WorkflowStatus.STOCK_CONTROLLER_APPROVAL, label: 'Stock Controller Review', role: 'Stock Controller' },
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
    };

    /**
     * Generates requested items table HTML
     */
    const generateRequestedItemsHTML = (workflow: WorkflowRequest): string => {
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
    };

    /**
     * Generates production-quality HTML email body - EXACT COPY FROM PRODUCTION
     */
    const generateWorkflowEmailHTML = (
        type: 'approval' | 'denial' | 'dispatch',
        workflow: WorkflowRequest,
        user: User
    ): string => {
        const ENPROTEC_BLUE = '#0B5FAA';
        const ENPROTEC_GREEN = '#00A651';
        const ENPROTEC_DARK = '#2D2D2D';
        const ENPROTEC_LIGHT_BLUE = '#1E7BC5';

        if (type === 'denial') {
            return `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${workflow.requestNumber} - Denied</title>
  </head>
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:40px 20px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1),0 2px 4px -1px rgba(0,0,0,0.06);">

            <!-- Header with Enprotec Branding (Denial) -->
            <tr>
              <td style="background:linear-gradient(135deg, ${ENPROTEC_DARK} 0%, #3d3d3d 100%);padding:32px 24px;text-align:center;">
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
                <h2 style="margin:0 0 16px 0;color:#1e293b;font-size:22px;font-weight:600;">Request ${workflow.requestNumber}</h2>
                <p style="margin:0 0 24px 0;color:#475569;font-size:15px;line-height:1.6;">
                  We regret to inform you that your request <strong>${workflow.requestNumber}</strong> for <strong>${workflow.projectCode}</strong> has been <strong style="color:#dc2626;">denied</strong>.
                </p>

                <!-- Reason for Denial -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px 0;background:#fef2f2;border-radius:12px;border:1px solid #fecaca;">
                  <tr>
                    <td style="padding:20px;">
                      <h3 style="margin:0 0 12px 0;color:#991b1b;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">❗ Reason for Denial</h3>
                      <p style="margin:0;color:#7f1d1d;font-size:14px;line-height:1.6;font-style:italic;">"Insufficient stock available for this request at this time."</p>
                    </td>
                  </tr>
                </table>

                <!-- Request Summary -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px 0;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;">
                  <tr>
                    <td style="padding:20px;">
                      <h3 style="margin:0 0 12px 0;color:#1e293b;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">📋 Request Summary</h3>
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                        <tr>
                          <td style="padding:6px 0;color:#64748b;font-size:13px;width:40%;">Request Number:</td>
                          <td style="padding:6px 0;color:#1e293b;font-size:13px;font-weight:600;">${workflow.requestNumber}</td>
                        </tr>
                        <tr>
                          <td style="padding:6px 0;color:#64748b;font-size:13px;width:40%;">Site/Project:</td>
                          <td style="padding:6px 0;color:#1e293b;font-size:13px;font-weight:600;">${workflow.projectCode}</td>
                        </tr>
                        <tr>
                          <td style="padding:6px 0;color:#64748b;font-size:13px;width:40%;">Department/Store:</td>
                          <td style="padding:6px 0;color:#1e293b;font-size:13px;font-weight:600;">${workflow.department}</td>
                        </tr>
                        <tr>
                          <td style="padding:6px 0;color:#64748b;font-size:13px;width:40%;">Priority:</td>
                          <td style="padding:6px 0;">
                            <span style="background:#fed7aa;color:#9a3412;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600;">${workflow.priority}</span>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding:6px 0;color:#64748b;font-size:13px;width:40%;">Status:</td>
                          <td style="padding:6px 0;color:#dc2626;font-size:13px;font-weight:700;">Denied</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>

                ${generateRequestedItemsHTML(workflow)}

              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:24px;background:#f8fafc;border-top:1px solid #e2e8f0;">
                <p style="margin:0 0 8px 0;color:#94a3b8;font-size:12px;text-align:center;">
                  © ${new Date().getFullYear()} Enprotec. All rights reserved.
                </p>
                <p style="margin:0;color:#cbd5e1;font-size:11px;text-align:center;">
                  This is an automated message from the Workflow Management System
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

        if (type === 'dispatch') {
            return `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${workflow.requestNumber} - Dispatched</title>
  </head>
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:40px 20px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1),0 2px 4px -1px rgba(0,0,0,0.06);">

            <!-- Header with Enprotec Branding -->
            <tr>
              <td style="background:linear-gradient(135deg, ${ENPROTEC_BLUE} 0%, ${ENPROTEC_LIGHT_BLUE} 100%);padding:32px 24px;text-align:center;">
                <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:-0.5px;">ENPROTEC</h1>
                <p style="margin:8px 0 0 0;color:#ffffff;font-size:14px;opacity:0.95;font-weight:500;">Workflow Management System</p>
              </td>
            </tr>

            <!-- Dispatch Badge -->
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
                <h2 style="margin:0 0 16px 0;color:#1e293b;font-size:22px;font-weight:600;">Request ${workflow.requestNumber}</h2>
                <p style="margin:0 0 24px 0;color:#475569;font-size:15px;line-height:1.6;">
                  Great news! Your order has been <strong style="color:#10b981;">dispatched</strong> and is on its way to you.
                </p>

                <!-- Delivery Information -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px 0;background:#ecfdf5;border-radius:12px;border:1px solid #a7f3d0;">
                  <tr>
                    <td style="padding:20px;">
                      <h3 style="margin:0 0 16px 0;color:#065f46;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">🚛 Delivery Information</h3>
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                        <tr>
                          <td style="padding:6px 0;color:#047857;font-size:13px;width:40%;">Driver:</td>
                          <td style="padding:6px 0;color:#064e3b;font-size:13px;font-weight:600;">${workflow.driverName || 'David Brown'}</td>
                        </tr>
                        <tr>
                          <td style="padding:6px 0;color:#047857;font-size:13px;width:40%;">Vehicle Reg:</td>
                          <td style="padding:6px 0;color:#064e3b;font-size:13px;font-weight:600;">${workflow.vehicleRegistration || 'GP-123-ABC'}</td>
                        </tr>
                        <tr>
                          <td style="padding:6px 0;color:#047857;font-size:13px;width:40%;">Destination:</td>
                          <td style="padding:6px 0;color:#064e3b;font-size:13px;font-weight:600;">${workflow.projectCode}</td>
                        </tr>
                        <tr>
                          <td style="padding:6px 0;color:#047857;font-size:13px;width:40%;">Department:</td>
                          <td style="padding:6px 0;color:#064e3b;font-size:13px;font-weight:600;">${workflow.department}</td>
                        </tr>
                        <tr>
                          <td style="padding:6px 0;color:#047857;font-size:13px;width:40%;">Dispatched By:</td>
                          <td style="padding:6px 0;color:#064e3b;font-size:13px;font-weight:600;">${user.name} (${user.role})</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>

                <!-- Request Details -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px 0;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;">
                  <tr>
                    <td style="padding:20px;">
                      <h3 style="margin:0 0 12px 0;color:#1e293b;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">📋 Request Details</h3>
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                        <tr>
                          <td style="padding:6px 0;color:#64748b;font-size:13px;width:40%;">Request Number:</td>
                          <td style="padding:6px 0;color:#1e293b;font-size:13px;font-weight:600;">${workflow.requestNumber}</td>
                        </tr>
                        <tr>
                          <td style="padding:6px 0;color:#64748b;font-size:13px;width:40%;">Site/Project:</td>
                          <td style="padding:6px 0;color:#1e293b;font-size:13px;font-weight:600;">${workflow.projectCode}</td>
                        </tr>
                        <tr>
                          <td style="padding:6px 0;color:#64748b;font-size:13px;width:40%;">Priority:</td>
                          <td style="padding:6px 0;">
                            <span style="background:#fed7aa;color:#9a3412;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600;">${workflow.priority}</span>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>

                ${generateRequestedItemsHTML(workflow)}

              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:24px;background:#f8fafc;border-top:1px solid #e2e8f0;">
                <p style="margin:0 0 8px 0;color:#94a3b8;font-size:12px;text-align:center;">
                  © ${new Date().getFullYear()} Enprotec. All rights reserved.
                </p>
                <p style="margin:0;color:#cbd5e1;font-size:11px;text-align:center;">
                  This is an automated message from the Workflow Management System
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

        // type === 'approval'
        const newStatus = WorkflowStatus.AWAITING_OPS_MANAGER; // Simulating pending approval state
        return `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${workflow.requestNumber} - Approval Required</title>
  </head>
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:40px 20px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1),0 2px 4px -1px rgba(0,0,0,0.06);">

            <!-- Header with Enprotec Branding -->
            <tr>
              <td style="background:linear-gradient(135deg, ${ENPROTEC_BLUE} 0%, ${ENPROTEC_LIGHT_BLUE} 100%);padding:32px 24px;text-align:center;">
                <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:-0.5px;">ENPROTEC</h1>
                <p style="margin:8px 0 0 0;color:#ffffff;font-size:14px;opacity:0.95;font-weight:500;">Workflow Management System</p>
              </td>
            </tr>

            <!-- Action Required Alert -->
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

            <!-- Status Badge -->
            <tr>
              <td style="padding:24px 24px 0 24px;text-align:center;">
                <div style="display:inline-block;background:#e0f2fe;color:#075985;padding:8px 20px;border-radius:20px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">
                  Pending Approval
                </div>
              </td>
            </tr>

            <!-- Main Content -->
            <tr>
              <td style="padding:24px 32px;">
                <h2 style="margin:0 0 16px 0;color:#1e293b;font-size:22px;font-weight:600;">Request ${workflow.requestNumber}</h2>
                <p style="margin:0 0 24px 0;color:#475569;font-size:15px;line-height:1.6;">
                  <strong style="color:${ENPROTEC_BLUE};">This request requires your approval.</strong> Please review the details below and take action in the system.
                </p>

                <!-- Request Details Card -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px 0;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;">
                  <tr>
                    <td style="padding:20px;">
                      <h3 style="margin:0 0 12px 0;color:#1e293b;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">📋 Request Details</h3>
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                        <tr>
                          <td style="padding:6px 0;color:#64748b;font-size:13px;width:40%;">Request Number:</td>
                          <td style="padding:6px 0;color:#1e293b;font-size:13px;font-weight:600;">${workflow.requestNumber}</td>
                        </tr>
                        <tr>
                          <td style="padding:6px 0;color:#64748b;font-size:13px;width:40%;">Site/Project:</td>
                          <td style="padding:6px 0;color:#1e293b;font-size:13px;font-weight:600;">${workflow.projectCode}</td>
                        </tr>
                        <tr>
                          <td style="padding:6px 0;color:#64748b;font-size:13px;width:40%;">Department/Store:</td>
                          <td style="padding:6px 0;color:#1e293b;font-size:13px;font-weight:600;">${workflow.department}</td>
                        </tr>
                        <tr>
                          <td style="padding:6px 0;color:#64748b;font-size:13px;width:40%;">Priority:</td>
                          <td style="padding:6px 0;">
                            <span style="background:#fed7aa;color:#9a3412;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600;">${workflow.priority}</span>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding:6px 0;color:#64748b;font-size:13px;width:40%;">Requested By:</td>
                          <td style="padding:6px 0;color:#1e293b;font-size:13px;font-weight:600;">${user.name}</td>
                        </tr>
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
                          <td style="padding:6px 0;color:#64748b;font-size:13px;font-weight:600;">Request Submitted</td>
                        </tr>
                        <tr>
                          <td style="padding:6px 0;color:#64748b;font-size:13px;width:40%;">New Status:</td>
                          <td style="padding:6px 0;color:${ENPROTEC_BLUE};font-size:13px;font-weight:700;">Awaiting Ops Manager</td>
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
                          <td style="padding:6px 0;color:#0c4a6e;font-size:13px;font-weight:600;">${user.name}</td>
                        </tr>
                        <tr>
                          <td style="padding:6px 0;color:#0369a1;font-size:13px;width:40%;">Email:</td>
                          <td style="padding:6px 0;color:#0c4a6e;font-size:13px;font-weight:600;">${user.email}</td>
                        </tr>
                        <tr>
                          <td style="padding:6px 0;color:#0369a1;font-size:13px;width:40%;">Role:</td>
                          <td style="padding:6px 0;color:#0c4a6e;font-size:13px;font-weight:600;">${user.role}</td>
                        </tr>
                        <tr>
                          <td style="padding:6px 0;color:#0369a1;font-size:13px;width:40%;">Timestamp:</td>
                          <td style="padding:6px 0;color:#0c4a6e;font-size:13px;font-weight:600;">${new Date().toLocaleString('en-ZA', { dateStyle: 'long', timeStyle: 'short' })}</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>

                ${generateRequestedItemsHTML(workflow)}

                <!-- Workflow Progress Card -->
                ${generateWorkflowProgressHTML(newStatus)}

                <!-- Comments Card -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px 0;background:#fffbeb;border-radius:12px;border:1px solid #fde68a;">
                  <tr>
                    <td style="padding:20px;">
                      <h3 style="margin:0 0 12px 0;color:#92400e;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">💬 Comments</h3>
                      <p style="margin:0;color:#78350f;font-size:14px;line-height:1.6;font-style:italic;">"This request has been submitted and requires Operations Manager approval before proceeding to stock allocation."</p>
                    </td>
                  </tr>
                </table>

              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:24px;background:#f8fafc;border-top:1px solid #e2e8f0;">
                <p style="margin:0 0 8px 0;color:#94a3b8;font-size:12px;text-align:center;">
                  © ${new Date().getFullYear()} Enprotec. All rights reserved.
                </p>
                <p style="margin:0;color:#cbd5e1;font-size:11px;text-align:center;">
                  This is an automated message from the Workflow Management System
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
    };

    // Test General Workflow Webhook (Approval with ACTION REQUIRED)
    const testApprovalWebhook = async () => {
        if (!sampleWorkflow || !currentUser) {
            setStatus('❌ No sample data available. Please ensure you have workflows in the database.');
            return;
        }

        setLoading(true);
        setStatus('Sending test approval email with workflow progress tracker...');

        try {
            // Build individual recipient fields
            const recipientFields: Record<string, string> = {};
            for (let i = 1; i <= 8; i++) {
                const recipient = TEST_RECIPIENTS[i - 1];
                recipientFields[`email${i}`] = recipient?.email || '';
                recipientFields[`name${i}`] = recipient?.name || '';
            }

            const allEmails = TEST_RECIPIENTS.map(r => r.email).join(';');
            const recipientCount = TEST_RECIPIENTS.length;

            const payload = {
                subject: `${sampleWorkflow.requestNumber} - Approval Required`,
                body: generateWorkflowEmailHTML('approval', sampleWorkflow, currentUser),
                to: allEmails,
                recipient_count: recipientCount,
                ...recipientFields,
            };

            const response = await fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorText = await response.text();
                setStatus(`❌ Failed: ${response.status} - ${errorText}`);
            } else {
                setStatus(`✅ Success! Test approval email sent to ${recipientCount} recipients with workflow progress tracker.`);
            }
        } catch (error) {
            setStatus(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setLoading(false);
        }
    };

    // Test Denial Webhook
    const testDenialWebhook = async () => {
        if (!sampleWorkflow || !currentUser) {
            setStatus('❌ No sample data available. Please ensure you have workflows in the database.');
            return;
        }

        setLoading(true);
        setStatus('Sending test denial email...');

        try {
            const recipientFields: Record<string, string> = {};
            for (let i = 1; i <= 8; i++) {
                if (i === 1) {
                    recipientFields[`email${i}`] = TEST_RECIPIENTS[0].email;
                    recipientFields[`name${i}`] = TEST_RECIPIENTS[0].name;
                } else {
                    recipientFields[`email${i}`] = '';
                    recipientFields[`name${i}`] = '';
                }
            }

            const payload = {
                subject: `${sampleWorkflow.requestNumber} - Denied`,
                body: generateWorkflowEmailHTML('denial', sampleWorkflow, currentUser),
                to: TEST_RECIPIENTS[0].email,
                recipient_count: 1,
                ...recipientFields,
            };

            const response = await fetch(DENIAL_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorText = await response.text();
                setStatus(`❌ Failed: ${response.status} - ${errorText}`);
            } else {
                setStatus(`✅ Success! Test denial email sent to ${TEST_RECIPIENTS[0].email}.`);
            }
        } catch (error) {
            setStatus(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setLoading(false);
        }
    };

    // Test Dispatch Webhook
    const testDispatchWebhook = async () => {
        if (!sampleWorkflow || !currentUser) {
            setStatus('❌ No sample data available. Please ensure you have workflows in the database.');
            return;
        }

        setLoading(true);
        setStatus('Sending test dispatch email...');

        try {
            const recipientFields: Record<string, string> = {};
            for (let i = 1; i <= 8; i++) {
                const recipient = TEST_RECIPIENTS[i - 1];
                recipientFields[`email${i}`] = recipient?.email || '';
                recipientFields[`name${i}`] = recipient?.name || '';
            }

            const allEmails = TEST_RECIPIENTS.map(r => r.email).join(';');
            const recipientCount = TEST_RECIPIENTS.length;

            const payload = {
                subject: `${sampleWorkflow.requestNumber} - Items Dispatched`,
                body: generateWorkflowEmailHTML('dispatch', sampleWorkflow, currentUser),
                to: allEmails,
                recipient_count: recipientCount,
                ...recipientFields,
            };

            const response = await fetch(DISPATCH_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorText = await response.text();
                setStatus(`❌ Failed: ${response.status} - ${errorText}`);
            } else {
                setStatus(`✅ Success! Test dispatch email sent to ${recipientCount} recipients.`);
            }
        } catch (error) {
            setStatus(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Email Webhook Test Page</h1>
                <p className="text-gray-600">
                    Test all three webhook email types with production-quality HTML including workflow progress tracker
                </p>
            </div>

            {(!sampleWorkflow || !currentUser) && (
                <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-yellow-800">⚠️ Loading sample data from database...</p>
                </div>
            )}

            {sampleWorkflow && currentUser && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h3 className="font-semibold text-blue-900 mb-2">Using Real Data:</h3>
                    <ul className="text-sm text-blue-800 space-y-1">
                        <li>• Workflow: <span className="font-mono">{sampleWorkflow.requestNumber}</span></li>
                        <li>• Project: {sampleWorkflow.projectCode}</li>
                        <li>• User: {currentUser.name} ({currentUser.role})</li>
                        <li>• Recipients: {TEST_RECIPIENTS.map(r => r.email).join(', ')}</li>
                    </ul>
                </div>
            )}

            <div className="space-y-4 mb-8">
                <div className="p-6 bg-white rounded-lg shadow-sm border border-gray-200">
                    <h2 className="text-xl font-semibold mb-3 text-gray-900">1. General Workflow Email (Approval Required)</h2>
                    <p className="text-gray-600 mb-4">
                        Tests the approval notification with ACTION REQUIRED banner and workflow progress tracker showing current step.
                    </p>
                    <button
                        onClick={testApprovalWebhook}
                        disabled={loading || !sampleWorkflow || !currentUser}
                        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium transition-colors"
                    >
                        {loading ? 'Sending...' : 'Test General Workflow Email'}
                    </button>
                </div>

                <div className="p-6 bg-white rounded-lg shadow-sm border border-gray-200">
                    <h2 className="text-xl font-semibold mb-3 text-gray-900">2. Denial Email</h2>
                    <p className="text-gray-600 mb-4">
                        Tests the denial notification with dark grey branding (single recipient only).
                    </p>
                    <button
                        onClick={testDenialWebhook}
                        disabled={loading || !sampleWorkflow || !currentUser}
                        className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium transition-colors"
                    >
                        {loading ? 'Sending...' : 'Test Denial Email'}
                    </button>
                </div>

                <div className="p-6 bg-white rounded-lg shadow-sm border border-gray-200">
                    <h2 className="text-xl font-semibold mb-3 text-gray-900">3. Dispatch Email</h2>
                    <p className="text-gray-600 mb-4">
                        Tests the dispatch notification with delivery information and Enprotec blue branding.
                    </p>
                    <button
                        onClick={testDispatchWebhook}
                        disabled={loading || !sampleWorkflow || !currentUser}
                        className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium transition-colors"
                    >
                        {loading ? 'Sending...' : 'Test Dispatch Email'}
                    </button>
                </div>
            </div>

            {status && (
                <div className={`p-4 rounded-lg ${status.includes('❌') ? 'bg-red-50 border border-red-200' : status.includes('✅') ? 'bg-green-50 border border-green-200' : 'bg-blue-50 border border-blue-200'}`}>
                    <p className={`font-medium ${status.includes('❌') ? 'text-red-900' : status.includes('✅') ? 'text-green-900' : 'text-blue-900'}`}>
                        {status}
                    </p>
                </div>
            )}

            <div className="mt-8 p-6 bg-gray-50 rounded-lg border border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-3">📚 Documentation References</h3>
                <ul className="space-y-2 text-sm text-gray-700">
                    <li>
                        • <span className="font-semibold">WEBHOOK-COMPLETE-SOLUTION.md</span> - Complete overview with workflow progress tracker
                    </li>
                    <li>
                        • <span className="font-semibold">MAKE-QUICK-SETUP.md</span> - Quick setup guide for Make.com Router configuration
                    </li>
                    <li>
                        • <span className="font-semibold">MAKE-OUTLOOK-SETUP.md</span> - Detailed Make.com scenario setup instructions
                    </li>
                    <li>
                        • <span className="font-semibold">WEBHOOK-RECIPIENT-COUNTS.md</span> - Expected recipient counts for each scenario
                    </li>
                </ul>
            </div>
        </div>
    );
};

export default EmailTestPage;
