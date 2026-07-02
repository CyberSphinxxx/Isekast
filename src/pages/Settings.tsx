import { useTheme } from "../components/ThemeProvider";
import { KeyRound, Paintbrush } from "lucide-react";
import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const [hasToken, setHasToken] = useState<boolean>(false);
  const [tokenInput, setTokenInput] = useState("");

  useEffect(() => {
    invoke<boolean>("get_tmdb_token_status")
      .then(setHasToken)
      .catch(console.error);
  }, []);

  const saveToken = async () => {
    try {
      await invoke("save_tmdb_token", { token: tokenInput });
      setHasToken(true);
      setTokenInput("");
    } catch (err) {
      console.error(err);
    }
  };

  const removeToken = async () => {
    try {
      await invoke("delete_tmdb_token");
      setHasToken(false);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-12">
      <h1 className="text-3xl font-bold">Settings</h1>
      
      {/* Appearance */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-xl font-semibold border-b border-border pb-2">
          <Paintbrush className="w-5 h-5 text-primary" />
          <h2>Appearance</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {["default", "dracula", "nord", "rose"].map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t as any)}
              className={`p-4 rounded-lg border-2 text-center capitalize transition-all ${
                theme === t ? "border-primary bg-primary/10" : "border-border hover:border-primary/50 bg-card"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </section>



      {/* Security */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-xl font-semibold border-b border-border pb-2">
          <KeyRound className="w-5 h-5 text-primary" />
          <h2>Security & API Keys</h2>
        </div>
        <div className="bg-card p-6 rounded-lg border border-border space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">TMDB Access Token</label>
            {hasToken ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-primary font-medium mb-1">Token is configured securely.</p>
                  <p className="text-sm text-muted-foreground">Stored securely in your OS keychain.</p>
                </div>
                <button onClick={removeToken} className="bg-destructive text-destructive-foreground px-4 py-2 rounded-md font-medium hover:bg-destructive/90 transition-colors">
                  Remove Token
                </button>
              </div>
            ) : (
              <div>
                <div className="flex gap-2">
                  <input 
                    type="password" 
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="••••••••••••••••"
                    className="flex-1 bg-background border border-border rounded-md px-4 py-2 focus:outline-none focus:border-primary"
                  />
                  <button onClick={saveToken} className="bg-primary text-primary-foreground px-4 py-2 rounded-md font-medium hover:bg-primary/90 transition-colors">
                    Save
                  </button>
                </div>
                <p className="text-sm text-muted-foreground mt-2">Stored securely in your OS keychain.</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
