# FitTrack

App pessoal de acompanhamento de treino (4 sessões: superiores, HIIT, inferiores, potência),
medidas e jogos. Mobile-first, instalável como PWA e funciona offline durante o treino.

## Como funciona

- **Front**: Vite + React + Tailwind. Toda leitura e escrita vai para o IndexedDB do aparelho
  (Dexie), então marcar uma série nunca depende de rede.
- **Sync**: cada escrita entra numa fila local e é enviada para `POST /api/sync` quando há
  rede. O servidor resolve conflito por "última escrita vence" e devolve o que mudou desde o
  último cursor.
- **Servidor**: um processo Node (Express) serve o build estático e a API. Os dados ficam em
  SQLite (`/app/data/fittrack.db`), com backup diário compactado.
- **Login**: um usuário só. A senha fica como hash scrypt em `APP_PASSWORD_HASH`; o login cria
  um cookie de sessão `httpOnly` válido por 1 ano.

## Estrutura

```
src/plan/plan.ts     plano de treino (sessões, exercícios, variações, aquecimento, HIIT)
src/domain/          regras de negócio puras (semana, alertas, progressão, ciclo, lembretes)
src/db/              IndexedDB local e operações (marcar série, desfazer, finalizar...)
src/sync/            fila de sincronização, API e login
src/pages/           telas
server/              Express, SQLite, auth, sync e backup
shared/              tipos do protocolo de sync
tests/               vitest (regras, repositório local, servidor)
```

Para mudar o plano, edite `src/plan/plan.ts` e faça redeploy. Não renomeie `id` de exercício
ou sessão que já tenha registros.

## Desenvolvimento

```bash
npm install
npm run hash-password -- "uma-senha"     # imprime APP_PASSWORD_HASH=...
APP_PASSWORD_HASH=... npm run dev:server  # API em :3000
npm run dev                               # front em :5173 (proxy de /api para :3000)

npm test                                  # testes
npm run build                             # tipagem + build de produção em dist/
APP_PASSWORD_HASH=... npm start           # serve dist/ + API em :3000
```

## Deploy no Dokploy

1. Crie o repositório no GitHub e envie o código.
2. Aponte o DNS (registro A) do domínio escolhido para este servidor.
3. No Dokploy, crie um serviço **Compose** ligado ao repositório (`docker-compose.yml`).
4. Em **Environment**, defina:
   - `FITTRACK_DOMAIN`: o domínio, sem `https://`.
   - `APP_PASSWORD_HASH`: saída de `npm run hash-password -- "sua-senha"`.
   - opcional: `BACKUP_HOST_DIR` (padrão `/opt/fittrack-backups`) e `BACKUP_RETENTION_DAYS` (padrão 14).
5. Faça o deploy. O Traefik emite o certificado e publica em `https://FITTRACK_DOMAIN`.

HTTPS é obrigatório: service worker, wake lock e o cookie de sessão não funcionam em HTTP.

### Trocar a senha

Gere um novo hash, atualize `APP_PASSWORD_HASH` e refaça o deploy. Sessões já abertas
continuam válidas; para derrubá-las, apague as linhas da tabela `sessions` do SQLite.

### Backup e restauração

- Diário às 03:30 (America/Sao_Paulo): `fittrack-AAAA-MM-DD.db.gz` em `BACKUP_HOST_DIR`.
- Restaurar: pare o container, descompacte o arquivo sobre `fittrack.db` no volume
  `fittrack-data` (apagando `fittrack.db-wal` e `fittrack.db-shm`) e suba de novo.
- Pelo app: **Mais › Configurações › Exportar/Importar** gera e lê um JSON com todos os dados.
  Importar substitui tudo, no aparelho e no servidor.
