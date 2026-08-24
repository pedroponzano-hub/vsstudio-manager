import { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";

function DomiaBrandPanel() {
  return (
    <aside className="login-brand-panel" aria-labelledby="domia-login-brand">
      <div>
        <p className="login-brand-name" id="domia-login-brand">DOMIA</p>
        <p className="login-brand-subtitle">Gestión &amp; Operaciones</p>
        <p className="login-brand-promise">Gestión inteligente para equipos de belleza.</p>
      </div>
      <div className="login-client-brand">
        <span>Espacio de trabajo</span>
        <strong>VS Studio Beauty &amp; Academy</strong>
      </div>
    </aside>
  );
}

function LoginLoading() {
  return (
    <main className="login-page">
      <section className="login-shell">
        <DomiaBrandPanel />
        <section className="login-access-panel login-loading-panel" aria-live="polite" aria-busy="true">
          <div className="login-form-wrap" role="status">
            <span className="login-spinner" aria-hidden="true" />
            <p className="login-access-eyebrow">Acceso seguro</p>
            <h1>Preparando tu espacio</h1>
            <p className="login-subtitle">Estamos verificando la sesión.</p>
          </div>
        </section>
      </section>
    </main>
  );
}

function Login() {
  const { login, authError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
      <section className="login-shell">
        <DomiaBrandPanel />
        <section className="login-access-panel">
          <div className="login-form-wrap">
            <header className="login-heading">
              <p className="login-access-eyebrow">Bienvenido</p>
              <h1>Acceso profesional</h1>
              <p className="login-subtitle">Accede a tu espacio de trabajo.</p>
            </header>
            <form className="login-form" onSubmit={submit}>
              <label htmlFor="login-email">
                Email
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  inputMode="email"
                />
              </label>
              <div className="login-field-group">
                <label htmlFor="login-password">Contraseña</label>
                <span className="login-password-field">
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                  />
                  <button
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    aria-pressed={showPassword}
                    className="login-password-toggle"
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                  >
                    {showPassword ? "Ocultar" : "Mostrar"}
                  </button>
                </span>
              </div>
              {(localError || authError) && <p className="login-error" role="alert">{localError || authError}</p>}
              <button className="login-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? "Accediendo…" : "Entrar"}</button>
            </form>
            <p className="login-security-note">Acceso privado para personal autorizado.</p>
          </div>
        </section>
      </section>
    </main>
  );
}

export default Login;
export { LoginLoading };
