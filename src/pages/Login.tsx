import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui";
import { HttpError } from "../sync/api";
import { login } from "../sync/auth";

export default function Login() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof HttpError ? err.message : "Sem conexão. O primeiro acesso precisa de internet.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mx-auto flex min-h-full max-w-sm flex-col justify-center gap-4 px-6">
      <div className="text-center">
        <div className="text-5xl">💪</div>
        <h1 className="mt-2 text-3xl font-black">FitTrack</h1>
        <p className="text-zinc-400">Entre para sincronizar seus treinos.</p>
      </div>
      <input
        type="password"
        autoComplete="current-password"
        autoFocus
        required
        placeholder="Senha"
        aria-label="Senha"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="bg-surface min-h-14 rounded-2xl px-4 text-lg outline-none focus:ring-2 focus:ring-lime-400"
      />
      {error && (
        <p role="alert" className="text-center text-rose-300">
          {error}
        </p>
      )}
      <Button type="submit" variant="primary" big disabled={busy || password.length === 0}>
        {busy ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
