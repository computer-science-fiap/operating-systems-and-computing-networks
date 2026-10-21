import { input, select } from '@inquirer/prompts';
import { AllocationMode, CompilerInput, SubnetRequirement } from '../types/network';

export async function runInteractivePrompts(): Promise<CompilerInput> {
  const cidrBlock = await input({
    message: '1. Digite o bloco IP base (ex: 192.168.10.0/24):',
    default: '192.168.10.0/24',
    validate: (val) => {
      const match = val.trim().match(/^(\d+\.\d+\.\d+\.\d+)\/(\d+)$/);
      if (!match) return 'Use o formato IP/CIDR (ex: 192.168.1.0/24)';
      const cidr = Number(match[2]);
      if (cidr < 8 || cidr > 30) return 'O CIDR deve estar entre /8 e /30';
      return true;
    },
  });

  const [baseIp, baseCidrStr] = cidrBlock.trim().split('/');
  const baseCidr = Number(baseCidrStr);

  const qtdSubredesStr = await input({
    message: '2. Quantas sub-redes você deseja criar? (1 ou mais):',
    default: '3',
    validate: (val) => {
      const n = Number(val);
      return !isNaN(n) && n >= 1 && n <= 24
        ? true
        : 'Digite um número entre 1 e 24 sub-redes.';
    },
  });
  const qtdSubredes = Number(qtdSubredesStr);

  const mode = await select<AllocationMode>({
    message: '3. Qual método de divisão de sub-redes você quer usar?',
    choices: [
      {
        name: 'FLSM (Tamanho Fixo - Todas as sub-redes com a mesma máscara)',
        value: 'FLSM',
      },
      {
        name: 'VLSM (Tamanho Variável - Calcula a máscara ideal pelo nº de hosts de cada rede)',
        value: 'VLSM',
      },
    ],
  });

  let fixedNewCidr: number | undefined;

  if (mode === 'FLSM') {
    const bitsNeeded = Math.ceil(Math.log2(qtdSubredes));
    const suggestedCidr = Math.min(30, baseCidr + Math.max(1, bitsNeeded));

    const newCidrStr = await input({
      message: `4. Qual será o novo prefixo CIDR para as ${qtdSubredes} sub-redes? (Mínimo sugerido: /${suggestedCidr}):`,
      default: String(suggestedCidr),
      validate: (val) => {
        const c = Number(val);
        if (isNaN(c) || c < baseCidr || c > 30) {
          return `O novo CIDR deve estar entre /${baseCidr} e /30`;
        }
        const maxSubnetsPossible = Math.pow(2, c - baseCidr);
        if (maxSubnetsPossible < qtdSubredes) {
          return `Uma máscara /${c} só comporta ${maxSubnetsPossible} sub-rede(s) dentro de um /${baseCidr}. Use pelo menos /${suggestedCidr}.`;
        }
        return true;
      },
    });
    fixedNewCidr = Number(newCidrStr);
  }

  const defaultPcsStr = await input({
    message: 'Quantos PCs você quer instanciar no Packet Tracer para cada sub-rede? (ex: 3):',
    default: '3',
    validate: (val) => {
      const n = Number(val);
      return !isNaN(n) && n >= 1 && n <= 10
        ? true
        : 'Escolha entre 1 e 10 PCs por sub-rede para manter o canvas organizado.';
    },
  });
  const defaultPcs = Number(defaultPcsStr);

  const subnets: SubnetRequirement[] = [];

  for (let i = 0; i < qtdSubredes; i++) {
    let requiredHosts = defaultPcs;
    let name = `LAN_${i + 1}`;

    if (mode === 'VLSM') {
      console.log(`\n--- Configuração da Sub-rede #${i + 1} ---`);
      name = await input({
        message: `Nome da Sub-rede #${i + 1}:`,
        default: `Setor_${i + 1}`,
      });

      const hostsStr = await input({
        message: `Quantos hosts (IPs úteis) o professor pediu para "${name}"?`,
        default: String( (qtdSubredes - i) * 15 ), // Ex: 45, 30, 15...
        validate: (val) => (!isNaN(Number(val)) && Number(val) >= 2 ? true : 'Mínimo de 2 hosts.'),
      });
      requiredHosts = Number(hostsStr);
    }

    subnets.push({
      name,
      requiredHosts,
      pcsToCreate: defaultPcs,
    });
  }

  return {
    baseIp,
    baseCidr,
    mode,
    fixedNewCidr,
    subnets,
  };
}