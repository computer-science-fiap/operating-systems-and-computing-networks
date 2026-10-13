import { CalculatedSubnet } from '../types/network';

export function printSubnetReport(subnets: CalculatedSubnet[]): void {
  console.log('\nTabela calculada de sub-redes');

  const tableData = subnets.map((s) => ({
    Subrede: s.name,
    'Rede / CIDR': `${s.networkAddress}/${s.cidr}`,
    'Máscara Decimal': s.subnetMask,
    'Gateway (Router)': s.gateway,
    '1º IP Útil': s.firstUsableIp,
    'Último IP Útil': s.lastUsableIp,
    Broadcast: s.broadcastAddress,
    'Hosts Úteis': s.usableHosts,
  }));

  console.table(tableData);
}