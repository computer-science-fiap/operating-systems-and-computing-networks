# Packet Tracer Network Compiler (`pt-net-compiler`)

> Compilador e gerador automático de topologias de rede, cálculo de sub-redes (FLSM/VLSM) e provisionamento via API IPC para o **Cisco Packet Tracer**.

Projeto desenvolvido no âmbito dos estudos de **Sistemas Operacionais e Redes de Computadores** na FIAP (2CCPS).

---

## 📌 Sobre o Projeto

O **Packet Tracer Network Compiler** é uma ferramenta em TypeScript / Node.js que resolve de ponta a ponta o processo de planejamento, cálculo de sub-redes e desenho de infraestrutura no Cisco Packet Tracer. 

A partir de um bloco IP base fornecido pelo usuário e da especificação de requisitos de cada sub-rede (quantidade de hosts e computadores), a ferramenta:

1. **Calcula o Endereçamento IPv4:** Suporta tanto **FLSM** (*Fixed-Length Subnet Mask*) quanto **VLSM** (*Variable-Length Subnet Mask*), calculando automaticamente endereços de rede, máscaras decimais e wildcard, gateways, primeiro e último IP utilizável, e endereços de broadcast.
2. **Desenha a Topologia Geometricamente:** Calcula o posicionamento bidimensional $(X, Y)$ de cada equipamento no canvas lógico do Packet Tracer com espaçamento adaptativo e desnível vertical (*staggering*) nos PCs para que nenhum texto ou cabo fique sobreposto.
3. **Escala Automaticamente a Arquitetura (Topologia Adaptativa):**
   - **Até 3 sub-redes:** Utiliza 1 roteador Cisco 2911 centralizado, aproveitando suas portas físicas nativas (`GigabitEthernet0/0`, `0/1`, `0/2`).
   - **4 ou mais sub-redes:** Supera o limite físico do Cisco 2911 instanciando um switch de trânsito (**`SW-Backbone`** na rede `10.255.255.0/24`) e múltiplos roteadores, conectando os uplinks e injetando automaticamente todas as **rotas estáticas cruzadas** via CLI IOS para comunicação total entre todas as sub-redes.
4. **Gera Artefatos Prontos para Execução:**
   - **`dist/deploy_pt.js`**: Script ES5 puro para a API IPC do Packet Tracer que limpa a tela, adiciona os equipamentos, conecta os cabos, configura os IPs, gateways e rotas em segundos.
   - **`dist/cisco_ios.txt`**: Bloco de comandos no padrão Cisco IOS CLI (`enable`, `configure terminal`, `interface`, `ip route`, etc.) pronto para ser colado em roteadores reais ou emulados.

---

## 🚀 Como Executar

### Pré-requisitos
- **Node.js** (v18 ou superior)
- **npm** (v9 ou superior)
- **Cisco Packet Tracer** (v7.x ou v8.x)

### 1. Instalação das Dependências

Entre no diretório do compilador e instale os pacotes:

```bash
cd pt-net-compiler
npm install
```

### 2. Execução Interativa

Inicie o assistente de linha de comando:

```bash
npm start
```

Ou compile para JavaScript e execute:

```bash
npm run build
node dist/index.js # ou via tsx
```

### 3. Respondendo aos Prompts da CLI
O terminal solicitará interativamente:
1. **Bloco IP Base:** Exemplo: `192.168.10.0/24` ou `10.0.0.0/16`.
2. **Quantidade de Sub-redes:** Exemplo: `2`, `3`, `4`, `6`...
3. **Modo de Divisão:** Escolha entre **FLSM** (tamanho fixo) ou **VLSM** (tamanho variável).
   - Se for **FLSM**, você pode confirmar ou personalizar o novo prefixo CIDR (ex: `/26`).
   - Se for **VLSM**, você informará o nome e a demanda de hosts para cada sub-rede (ordenadas automaticamente pela regra de maior demanda).
4. **Quantidade de PCs por Sub-rede:** Exemplo: `2` a `5` PCs por rede para desenhar no canvas.

---

## 🖥️ Como Aplicar no Cisco Packet Tracer

Assim que a compilação terminar, a tabela de sub-redes será impressa no terminal e os arquivos serão gerados na pasta `pt-net-compiler/dist/`.

1. Abra o **Cisco Packet Tracer**.
2. Abra um novo arquivo em branco.
3. No menu superior, clique em:
   - **Extensions** $\rightarrow$ **Scripting** $\rightarrow$ **Script Projects...** (ou abra o **Script Editor**).
4. Cole todo o conteúdo do arquivo gerado em [`pt-net-compiler/dist/deploy_pt.js`](./pt-net-compiler/dist/deploy_pt.js).
5. Clique em **Run**.
6. A topologia será imediatamente desenhada, cabeada e configurada com os IPs e rotas ativas!

Para testar a conectividade:
- Clique em qualquer PC, abra a aba **Desktop** $\rightarrow$ **Command Prompt** e execute `ping <IP_DO_GATEWAY>` ou dê ping no IP de um PC de outra sub-rede.

---

## 📂 Estrutura do Repositório

```
├── README.md                           # Visão geral do projeto e guia de uso rápido
├── docs/
│   └── TECHNICAL_DOCUMENTATION.md      # Documentação técnica completa e aprofundada
└── pt-net-compiler/                    # Código-fonte do compilador TypeScript
    ├── src/
    │   ├── index.ts                    # Ponto de entrada da aplicação
    │   ├── types/network.ts            # Interfaces e tipos de dados do domínio
    │   ├── core/bitwise.ts             # Cálculos matemáticos bit a bit (IPv4)
    │   ├── core/subnet-engine.ts       # Motor de alocação de sub-redes (FLSM/VLSM)
    │   ├── cli/prompts.ts              # Perguntas e validações interativas
    │   ├── cli/printer.ts              # Renderizador de tabelas no console
    │   └── compiler/
    │       ├── layout-engine.ts        # Cálculo geométrico de coordenadas 2D no canvas
    │       └── pt-ipc-builder.ts       # Compilador de script IPC ES5 e Cisco IOS CLI
    ├── dist/
    │   ├── deploy_pt.js                # Artefato executável no Packet Tracer
    │   └── cisco_ios.txt               # Comandos Cisco IOS CLI gerados
    ├── package.json
    └── tsconfig.json
```

---

## 📖 Documentação Técnica Detalhada

Para uma análise minuciosa de cada módulo, equações matemáticas de divisão de rede, funcionamento interno da API IPC do Packet Tracer e diagrama de roteamento multirroteador, consulte:

👉 **[Documentação Técnica Detalhada (docs/TECHNICAL_DOCUMENTATION.md)](./docs/TECHNICAL_DOCUMENTATION.md)**

---

## 📝 Licença

Projeto desenvolvido para fins educacionais no curso de Ciência da Computação / Engenharia de Software da FIAP.
