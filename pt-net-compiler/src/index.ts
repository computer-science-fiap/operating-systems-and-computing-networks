import { select } from '@inquirer/prompts';
import { runFreeMode } from './modes/free';
import { runCheckpointMode } from './modes/checkpoint';

type RunMode = 'checkpoint' | 'free';

async function bootstrap() {
  try {
    console.clear();
    console.log(' Automação de sub-redes PT\n');

    const mode = await select<RunMode>({
      message: 'Qual tipo de execução?',
      choices: [
        {
          name: 'Checkpoint — VLSM pelos RMs da dupla + R1/R2 com RIP + servidor',
          value: 'checkpoint',
        },
        {
          name: 'Calculadora livre — FLSM/VLSM genérico',
          value: 'free',
        },
      ],
    });

    if (mode === 'checkpoint') {
      await runCheckpointMode();
    } else {
      await runFreeMode();
    }
  } catch (error: any) {
    if (error?.name === 'ExitPromptError') {
      console.log('\nCancelado.');
      process.exit(0);
    }
    console.error('\nErro:', error.message);
    process.exit(1);
  }
}

bootstrap();
