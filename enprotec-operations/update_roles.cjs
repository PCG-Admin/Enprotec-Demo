const fs = require('fs');

const filesToProcess = [
    'api/update-user.ts',
    'api/create-user.ts',
    'components/Dashboard.tsx',
    'components/Deliveries.tsx',
    'components/EquipmentManager.tsx',
    'components/forms/StockIntakeForm.tsx',
    'components/forms/StockRequestForm.tsx',
    'components/Picking.tsx',
    'components/RejectedRequests.tsx',
    'components/Reports.tsx',
    'components/Requests.tsx',
    'components/SalvagePage.tsx',
    'components/StockManagement.tsx',
    'components/StockReceipts.tsx',
    'components/WorkflowDetailModal.tsx',
    'components/WorkflowList.tsx',
    'services/webhookService.ts',
    'utils/workflowActors.ts'
];

for (const filePath of filesToProcess) {
    if (!fs.existsSync(filePath)) continue;
    let code = fs.readFileSync(filePath, 'utf-8');
    let origCode = code;

    // Replace user.role === UserRole...
    code = code.replace(/user\.role\s*===\s*(UserRole\.[a-zA-Z]+|'[^']+')/g, 'getMappedRole(user.role) === $1');
    code = code.replace(/user\.role\s*!==\s*(UserRole\.[a-zA-Z]+|'[^']+')/g, 'getMappedRole(user.role) !== $1');

    // Replace role === UserRole... (careful not to match inside words or other property accesses)
    code = code.replace(/(?<!\w|\.)role\s*===\s*(UserRole\.[a-zA-Z]+|'[^']+')/g, 'getMappedRole(role) === $1');
    code = code.replace(/(?<!\w|\.)role\s*!==\s*(UserRole\.[a-zA-Z]+|'[^']+')/g, 'getMappedRole(role) !== $1');

    if (code !== origCode) {
        if (!code.includes('getMappedRole')) {
            // attempt inject 
        }
        const depth = filePath.split('/').length - 1;
        const prefix = depth === 0 ? './' : '../'.repeat(depth);

        code = code.replace(/import\s+\{([^}]*)\}\s+from\s+['"](.*types)['"]/, (match, imports, path) => {
            if (match.includes('getMappedRole')) return match;
            return `import { getMappedRole, ${imports.trim()} } from '${path}'`;
        });

        // Fallback if not injected:
        if (!code.match(/import.*getMappedRole.*from.*types/)) {
            code = `import { getMappedRole } from '${prefix}types';\n` + code;
            // For API routes, if it's api/update-user.ts, prefix relative to types is '../src/types'
            if (filePath.startsWith('api/')) {
                code = code.replace(`from '../types'`, `from '../src/types'`);
            }
        }

        fs.writeFileSync(filePath, code);
        console.log('Modified ' + filePath);
    }
}
