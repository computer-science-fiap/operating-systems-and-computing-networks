import * as path from 'path';
import { writeArtifacts } from '../cli/output';
import { runCheckpointPrompts } from '../checkpoint/prompts';
import { buildCheckpointPlan } from '../checkpoint/planner';
import { printCheckpointReport } from '../checkpoint/printer';
import { buildCheckpointDeployment, compileCheckpointToCiscoIOS } from '../checkpoint/deployment';
import { compileCheckpointReport } from '../checkpoint/report';
import { compileDeploymentToES5 } from '../compiler/pt-es5-runtime';

export async function runCheckpointMode(): Promise<void> {
  const input = await runCheckpointPrompts();
  const plan = buildCheckpointPlan(input);

  printCheckpointReport(plan);

  const outDir = path.join(process.cwd(), 'dist', `checkpoint_${plan.params.rmA}_${plan.params.rmB}`);
  const [ptScriptPath, iosCliPath, reportPath] = writeArtifacts(outDir, {
    'deploy_pt.js': compileDeploymentToES5(buildCheckpointDeployment(plan)),
    'cisco_ios.txt': compileCheckpointToCiscoIOS(plan),
    'exercicio1.md': compileCheckpointReport(plan),
  });

  console.log('\nCheckpoint compilado com sucesso!');
  console.log(`Script Packet Tracer: ${ptScriptPath}`);
  console.log(`Script Cisco IOS:     ${iosCliPath}`);
  console.log(`Respostas Ex. 1:      ${reportPath}`);
  if (!plan.switchManagement.autoConfigure) {
    console.log(
      `\nLembrete: faça o ping ao ${plan.switchManagement.switchName} (${plan.switchManagement.ip}) ANTES de aplicar o bloco de gerência do cisco_ios.txt.`
    );
  }
  console.log(`Salve o arquivo como Checkpoint_${plan.params.rmA}_${plan.params.rmB}.pkt\n`);
}
