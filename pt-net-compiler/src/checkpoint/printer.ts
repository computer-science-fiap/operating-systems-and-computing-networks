import { CheckpointPlan } from '../types/checkpoint';

export function gatewayRuleLabel(plan: CheckpointPlan): string {
  return plan.params.isEven ? 'PAR → gateway = 1º host' : 'ÍMPAR → gateway = penúltimo host';
}

export function printCheckpointReport(plan: CheckpointPlan): void {
  const { params, wan, switchManagement: mgmt } = plan;

  console.log('\nParâmetros da dupla');
  console.table({
    'RM A': params.rmA,
    'RM B': params.rmB,
    'S = RM_A + RM_B': params.sum,
    N: params.n,
    'Bloco base': `${params.baseIp}/${params.baseCidr}`,
    'Regra do gateway': gatewayRuleLabel(plan),
    'Dígitos d1..d5': params.digits.join(' '),
  });

  console.log('\n1.1 Dimensionamento e ordenação');
  console.table(
    plan.departments.map((d) => ({
      Ordem: `${d.order}º`,
      Departamento: d.isServers ? `${d.id} (Servidores)` : d.id,
      Hosts: d.requiredHosts,
      Prefixo: `/${d.cidr}`,
      Máscara: d.subnetMask,
    }))
  );

  console.log('\n1.2 Alocação e gateways');
  console.table(
    plan.departments.map((d) => ({
      Nº: d.id,
      Hosts: d.requiredHosts,
      '/n': `/${d.cidr}`,
      Rede: d.networkAddress,
      'Faixa válida': `${d.firstUsableIp} - ${d.lastUsableIp}`,
      Broadcast: d.broadcastAddress,
      Gateway: d.gateway,
    }))
  );

  console.log('\n1.3 Enlace WAN e gerência do switch');
  console.table({
    'Rede WAN': `${wan.networkAddress}/${wan.cidr}`,
    'R1 (1º host)': wan.r1Ip,
    'R2 (2º host)': wan.r2Ip,
    Broadcast: wan.broadcastAddress,
    [`Gerência ${mgmt.switchName}`]: mgmt.ip,
  });

  console.log('\nInterfaces dos roteadores');
  console.table([
    ...[...plan.departments]
      .sort((a, b) => a.id - b.id)
      .map((d) => ({ Roteador: d.router, Interface: d.routerInterface, Rede: d.name, IP: d.gateway })),
    { Roteador: 'R1', Interface: wan.r1Interface, Rede: 'WAN', IP: wan.r1Ip },
    { Roteador: 'R2', Interface: wan.r2Interface, Rede: 'WAN', IP: wan.r2Ip },
  ]);
}
