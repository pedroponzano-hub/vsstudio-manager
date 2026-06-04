import { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";

function Login() {
  const { login, authError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setLocalError("");
    if (!email.trim() || !password) {
      setLocalError("Introduce email y contrasena.");
      return;
    }

    setIsSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch {
      // AuthContext muestra el mensaje de acceso.
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-card">
        <div>
          <p className="eyebrow">VS Studio Manager</p>
          <h1>Acceso profesional</h1>
          <p className="login-subtitle">Gestion interna de agenda, ventas y clientes.</p>
        </div>
        <form className="login-form" onSubmit={submit}>
          <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></label>
          <label>Contrasena<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" /></label>
          {(localError || authError) && <p className="auth-error">{localError || authError}</p>}
          <button type="submit" disabled={isSubmitting}>{isSubmitting ? "Entrando..." : "Entrar"}</button>
        </form>
      </section>
    </main>
  );
}

export default Login;
