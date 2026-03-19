const fs = require('fs');

const filesToProcess = [
    'api/update-user.ts',
    'api/create-user.ts',
    'src/components/Dashboard.tsx',
    'src/components/Deliveries.tsx',
    'src/components/EquipmentManager.tsx',
    'src/components/forms/StockIntakeForm.tsx',
    'src/components/forms/StockRequestForm.tsx',
    'src/components/Picking.tsx',
    'src/components/RejectedRequests.tsx',
    'src/components/Reports.tsx',
    'src/components/Requests.tsx',
    'src/components/SalvagePage.tsx',
    'src/components/StockManagement.tsx',
    'src/components/StockReceipts.tsx',
    'src/components/WorkflowDetailModal.tsx',
    'src/components/WorkflowList.tsx',
    'src/services/webhookService.ts',
    'src/utils/workflowActors.ts'
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
            // should never happen
        }

        // Attempt to inject import
        const depth = filePath.split('/').length - 1;
        const prefix = depth === 0 ? './' : '../'.repeat(depth);

        code = code.replace(/import\s+\{([^}]*)\}\s+from\s+['"](.*types)['"]/, (match, imports, path) => {
            if (match.includes('getMappedRole')) return match;
            return `import { getMappedRole, ${imports.trim()} } from '${path}'`;
        });

        // Fallback if not injected:
        if (!code.match(/import.*getMappedRole.*from.*types/)) {
            code = `import { getMappedRole } from '${prefix}types';\n` + code;
        }

        fs.writeFileSync(filePath, code);
        console.log('Modified ' + filePath);
    }
}
