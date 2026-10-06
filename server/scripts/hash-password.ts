import { hashPassword } from "../password";

const password = process.argv[2];
if (!password || password.length < 8) {
  console.error('Uso: npm run hash-password -- "sua-senha" (mínimo de 8 caracteres)');
  process.exit(1);
}
console.log(`APP_PASSWORD_HASH=${hashPassword(password)}`);
