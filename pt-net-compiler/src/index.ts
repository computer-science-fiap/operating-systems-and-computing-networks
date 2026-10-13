import * as fs from 'fs';
import * as path from 'path';
import { runInteractivePrompts } from './cli/prompts';
import { printSubnetReport } from './cli/printer';
import { calculateSubnets } from './core/subnet-engine';
import { compileToCiscoIOS, compileToPacketTracerES5 } from './compiler/pt-ipc-builder';

async function bootstrap() {
  try {
    const userInput = await runInteractivePrompts();
    const calculatedSubnets = calculateSubnets(userInput);

    printSubnetReport(calculatedSubnets);

    const distDir = path.join(process.cwd(), 'dist');
    if (!fs.existsSync(distDir)) {
      fs.mkdirSync(distDir, { recursive: true });
    }

    const ptScriptPath = path.join(distDir, 'deploy_pt.js');
    const iosCliPath = path.join(distDir, 'cisco_ios.txt');

    fs.writeFileSync(ptScriptPath, compileToPacketTracerES5(calculatedSubnets), 'utf-8');
    fs.writeFileSync(iosCliPath, compileToCiscoIOS(calculatedSubnets), 'utf-8');

    console.log('\nCompilado com sucesso!');
    console.log(`Script Packet Tracer: ${ptScriptPath}`);
    console.log(`Script Cisco IOS: ${iosCliPath}\n`);
  } catch (error: any) {
    console.error('\nErro:', error.message);
    process.exit(1);
  }
}

bootstrap();