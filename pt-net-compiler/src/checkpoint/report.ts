import { CheckpointPlan } from '../types/checkpoint';
import { buildRouterCli, buildSwitchManagementCli } from './deployment';
import { gatewayRuleLabel } from './printer';

function table(headers: string[], rows: Array<Array<string | number>>): string {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((r) => `| ${r.join(' | ')} |`),
  ].join('\n');
}

export function compileCheckpointReport(plan: CheckpointPlan): string {
  const { params, wan, switchManagement: mgmt } = plan;
  const byId = [...plan.departments].sort((a, b) => a.id - b.id);
  const dept1 = byId[0];
  const dept2 = byId[1];
  const servers = byId.find((d) => d.isServers)!;
  const server = servers.endDevices[0];
  const pc1 = dept1.endDevices[0];
  const pc2 = dept2.endDevices[0];

  return `# Checkpoint — VLSM + Packet Tracer

**RM A:** ${params.rmA} · **RM B:** ${params.rmB} · **Arquivo de entrega:** \`Checkpoint_${params.rmA}_${params.rmB}.pkt\`

## Parâmetros da dupla

${table(
  ['Parâmetro', 'Valor'],
  [
    ['S = RM_A + RM_B', `${params.rmA} + ${params.rmB} = ${params.sum}`],
    ['N (dois últimos dígitos de S)', params.n],
    ['Bloco base', `${params.baseIp}/${params.baseCidr}`],
    ['Paridade de S', gatewayRuleLabel(plan)],
    ['d1 d2 d3 d4 d5', params.digits.join(' ')],
  ]
)}

${table(
  ['Departamento', ...byId.map((d) => (d.isServers ? `${d.id} (Servidores)` : String(d.id)))],
  [
    ['dígito d_i', ...byId.map((d) => d.digit)],
    ['Host_i = 20 + d_i×220', ...byId.map((d) => d.requiredHosts)],
  ]
)}

## Exercício 1 — Projeto de endereçamento (VLSM)

### 1.1 Dimensionamento e ordenação

Hosts válidos = 2ⁿ − 2. Para cada departamento foi escolhido o menor prefixo cujo nº de hosts válidos atende a demanda.

${table(
  ['Ordem (maior→menor)', 'Departamento (nº)', 'Hosts necessários', 'Prefixo (/n)', 'Máscara decimal'],
  plan.departments.map((d) => [
    `${d.order}º`,
    d.isServers ? `${d.id} (Servidores)` : d.id,
    d.requiredHosts,
    `/${d.cidr}`,
    d.subnetMask,
  ])
)}

### 1.2 Alocação (sem sobreposição) e gateways

${table(
  ['Nº', 'Hosts', '/n', 'Endereço de rede', 'Faixa de hosts válidos', 'Broadcast', 'Gateway'],
  plan.departments.map((d) => [
    d.id,
    d.requiredHosts,
    `/${d.cidr}`,
    d.networkAddress,
    `${d.firstUsableIp} – ${d.lastUsableIp}`,
    d.broadcastAddress,
    d.gateway,
  ])
)}

### 1.3 Enlace WAN e gerência do switch

${table(
  ['Item', 'Endereço'],
  [
    ['Rede WAN', `${wan.networkAddress}/${wan.cidr} (${wan.subnetMask})`],
    ['R1 (1º host)', wan.r1Ip],
    ['R2 (2º host)', wan.r2Ip],
    ['Broadcast', wan.broadcastAddress],
    [`IP de gerência do ${mgmt.switchName} (último host do Depto ${mgmt.departmentId})`, `${mgmt.ip} ${mgmt.subnetMask}`],
  ]
)}

## Exercício 2 — Implementação no Packet Tracer

### Interfaces dos roteadores (Router-PT)

${table(
  ['Roteador', 'Interface', 'Rede', 'IP / máscara', 'Ligação'],
  [
    ...byId.map((d) => [
      d.router,
      d.routerInterface,
      d.name,
      `${d.gateway} ${d.subnetMask}`,
      `${d.switchName} (${d.switchModel}) ${d.switchUplinkPort} · ${d.uplinkCable === 'fiber' ? 'fibra' : 'cobre direto'}`,
    ]),
    ['R1', wan.r1Interface, 'WAN', `${wan.r1Ip} ${wan.subnetMask}`, 'R2 Serial2/0 · serial DCE'],
    ['R2', wan.r2Interface, 'WAN', `${wan.r2Ip} ${wan.subnetMask}`, 'R1 Serial2/0 · serial DTE'],
  ]
)}

### Hosts

${table(
  ['Dispositivo', 'Switch / porta', 'IP', 'Máscara', 'Gateway'],
  byId.flatMap((d) =>
    d.endDevices.map((h) => [h.name, `${d.switchName} ${h.switchPort}`, h.ip, d.subnetMask, d.gateway])
  )
)}

### Roteamento (RIP v2)

Todas as sub-redes estão dentro de \`${plan.ripNetwork}\` (rede classful), então um único \`network\` por roteador anuncia tudo. O \`no auto-summary\` evita que o RIP resuma as sub-redes VLSM pela classe.

\`\`\`
${buildRouterCli(plan, 'R1').join('\n')}
\`\`\`

\`\`\`
${buildRouterCli(plan, 'R2').join('\n')}
\`\`\`

### IP de gerência do ${mgmt.switchName}

\`\`\`
${buildSwitchManagementCli(plan).join('\n')}
\`\`\`

**Por que o primeiro ping falha e o segundo responde?** O switch 2960 opera na camada 2: ele encaminha quadros pelos endereços MAC e não precisa de IP para comutar o tráfego dos PCs. Sem IP, porém, ele não é um destino na camada 3. Ninguém responde ao ARP de ${mgmt.ip}, então o ping dá *Request timed out*. Ao configurar a interface virtual \`interface vlan 1\` com ${mgmt.ip}/${mgmt.subnetMask} e dar \`no shutdown\`, o switch passa a responder ARP e ICMP. O IP serve ao **plano de gerência**: acesso remoto (Telnet/SSH), SNMP, monitoramento e testes como o ping. O \`ip default-gateway ${mgmt.defaultGateway}\` permite que ele responda também a hosts de outras redes.

### Testes exigidos

${table(
  ['#', 'Origem', 'Comando / ação', 'O que comprova'],
  [
    [1, pc1.name, `ping ${dept1.gateway}`, 'Gateway local ativo'],
    [2, pc1.name, `ping ${pc2.ip} (${pc2.name})`, 'R1 roteia entre as redes'],
    [3, pc1.name, `ping ${mgmt.ip} (antes e depois do IP de gerência)`, 'Switch com IP responde'],
    [4, pc1.name, `ping ${server.ip} (${server.name})`, 'WAN + rotas RIP nos 2 roteadores'],
    [5, pc1.name, `Web Browser → http://${server.ip}`, 'Acesso remoto ao servidor (HTTP)'],
  ]
)}

Comandos úteis para conferir: \`ipconfig\` nos PCs; \`show ip interface brief\` e \`show ip route\` nos roteadores (as rotas aprendidas aparecem com **R**).
`;
}
