param()
$file = 'apps\frontend\src\features\resources\ResourcesPage.tsx'
$lines = Get-Content $file -Encoding UTF8

# Find the line with filteredResources.map and the following pattern without ID
$startLine = -1
for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match 'filteredResources\.map\(\(resource: Resource\)') {
        # Check if next few lines don't have the ID column (meaning we need to patch)
        $hasIdCol = $false
        for ($j = $i+1; $j -lt [Math]::Min($i+5, $lines.Count); $j++) {
            if ($lines[$j] -match 'resource\.id\.slice') {
                $hasIdCol = $true
                break
            }
        }
        if (-not $hasIdCol) {
            $startLine = $i
            break
        }
    }
}

if ($startLine -eq -1) {
    Write-Host "Pattern already patched or not found - checking..."
    # Check if it's already been patched
    $check = $lines | Select-String 'resource\.id\.slice'
    if ($check) {
        Write-Host "File already has ID column - no patch needed"
        exit 0
    }
    Write-Error "Could not find target"
    exit 1
}

Write-Host "Found rows at line $($startLine + 1)"

# Find the end of the map (the closing )) of the filteredResources.map)
$endLine = -1
for ($i = $startLine + 1; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match '^\s+\)\)$' -or ($lines[$i].Trim() -eq '))' -and $lines[$i-1].Trim() -eq '}')) {
        $endLine = $i
        break
    }
}

if ($endLine -eq -1) {
    Write-Error "Could not find end of map"
    exit 1
}

Write-Host "Map ends at line $($endLine + 1)"

# Build the replacement lines
$newLines = @(
    "                   filteredResources.map((resource: Resource) => (",
    "                     <tr key={resource.id}>",
    "                       <td>",
    "                         <span style={{",
    "                           fontFamily: 'Geist Mono, monospace',",
    "                           fontSize: '0.7rem',",
    "                           color: 'var(--ink-soft)',",
    "                           background: 'var(--panel-soft)',",
    "                           padding: '0.15rem 0.4rem',",
    "                           borderRadius: '0.3rem',",
    "                           border: '1px solid var(--border)',",
    "                           letterSpacing: '0.04em',",
    "                           cursor: 'help'",
    "                         }}",
    "                           title={resource.id}",
    "                         >",
    "                           #{resource.id.slice(0, 6).toUpperCase()}",
    "                         </span>",
    "                       </td>",
    "                       <td className=""strong-cell"">{resource.name}</td>",
    "                       <td>",
    "                         <Badge variant={resource.type === 'MAQUINA' ? 'default' : 'default'}>",
    "                           {resource.type === 'MAQUINA' ? '' : ''}",
    "                         </Badge>",
    "                       </td>",
    "                       <td>{resource.sector ?? <span style={{ color: 'var(--ink-soft)' }}>-</span>}</td>",
    "                       <td>",
    "                         <Badge variant={",
    "                           resource.status === 'DISPONIBLE' ? 'success' : ",
    "                           resource.status === 'MANTENIMIENTO' ? 'warning' : 'destructive'}",
    "                         >",
    "                           {resource.status}",
    "                         </Badge>",
    "                       </td>",
    "                       <td style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem', alignItems: 'center' }}>",
    "                         <select",
    "                           className=""control-bar__select""",
    "                           value={resource.status}",
    "                           onChange={(e) => statusMutation.mutate({ id: resource.id, status: e.target.value })}",
    "                           style={{ padding: '0.4rem', borderRadius: '0.4rem', border: '1px solid var(--border)', background: 'var(--panel)' }}",
    "                         >",
    "                           <option value=""DISPONIBLE"">DISPONIBLE</option>",
    "                           <option value=""OCUPADO"">OCUPADO</option>",
    "                           <option value=""MANTENIMIENTO"">MANTENIMIENTO</option>",
    "                           <option value=""FUERA_DE_LINEA"">FUERA_DE_LINEA</option>",
    "                         </select>",
    "                         <Button",
    "                           variant=""secondary""",
    "                           size=""sm""",
    "                           type=""button""",
    "                           onClick={() => {",
    "                             setEditingResourceId(resource.id);",
    "                             setForm({",
    "                               type: resource.type,",
    "                               name: resource.name,",
    "                               sector: resource.sector ?? '',",
    "                               status: resource.status,",
    "                               notes: resource.notes ?? ''",
    "                             });",
    "                             setFormError(null);",
    "                             setIsModalOpen(true);",
    "                           }}",
    "                         >",
    "                           Editar",
    "                         </Button>",
    "                       </td>",
    "                     </tr>",
    "                   ))"
)

# Replace the section
$before = $lines[0..($startLine - 1)]
$after = $lines[($endLine + 1)..($lines.Count - 1)]
$result = $before + $newLines + $after

Set-Content -Path $file -Value $result -Encoding UTF8
Write-Host "ResourcesPage patched successfully ($($newLines.Count) new lines replacing $($endLine - $startLine + 1) old lines)"
