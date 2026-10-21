import * as path from 'path';
import { runInteractivePrompts } from '../cli/prompts';
import { printSubnetReport } from '../cli/printer';
import { writeArtifacts } from '../cli/output';
import { calculateSubnets } from '../core/subnet-engine';
import { compileToCiscoIOS, compileToPacketTracerES5 } from '../compiler/pt-ipc-builder';

export async function runFreeMode(): Promise<void> {
  const userInput = await runInteractivePrompts();
  const calculatedSubnets = calculateSubnets(userInput);

  printSubnetReport(calculatedSubnets);

  const [ptScriptPath, iosCliPath] = writeArtifacts(path.join(process.cwd(), 'dist'), {
    'deploy_pt.js': compileToPacketTracerES5(calculatedSubnets),
    'cisco_ios.txt': compileToCiscoIOS(calculatedSubnets),
  });

  console.log('\nCompilado com sucesso!');
  console.log(`Script Packet Tracer: ${ptScriptPath}`);
  console.log(`Script Cisco IOS: ${iosCliPath}\n`);
}
