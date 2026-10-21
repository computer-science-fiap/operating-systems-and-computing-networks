import { confirm, input } from '@inquirer/prompts';
import { CheckpointInput } from '../types/checkpoint';
import { parseRm } from './params';

function validateRm(val: string): true | string {
  try {
    parseRm(val);
    return true;
  } catch {
    return 'Digite apenas os dígitos da matrícula (ex: 566966).';
  }
}

export async function runCheckpointPrompts(): Promise<CheckpointInput> {
  const rmA = await input({ message: '1. Matrícula A (RM):', validate: validateRm });
  const rmB = await input({ message: '2. Matrícula B (RM):', validate: validateRm });

  const pcsStr = await input({
    message: '3. Quantos PCs por departamento (Deptos 1–4)?',
    default: '1',
    validate: (val) => {
      const n = Number(val);
      return Number.isInteger(n) && n >= 1 && n <= 4 ? true : 'Escolha um inteiro entre 1 e 4.';
    },
  });

  const configureSwitchManagement = await confirm({
    message:
      '4. Configurar já o IP de gerência do SW1? (o checkpoint pede o ping ANTES e DEPOIS — responda "não" para fazer na mão)',
    default: false,
  });

  return {
    rmA: rmA.trim(),
    rmB: rmB.trim(),
    pcsPerDepartment: Number(pcsStr),
    configureSwitchManagement,
  };
}
