import { useTheme } from "../components/ThemeProvider";
import { KeyRound, Paintbrush, Link as LinkIcon, CheckCircle2 } from "lucide-react";
import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const [hasToken, setHasToken] = useState<boolean>(false);
  const [tokenInput, setTokenInput] = useState("");

  const [hasAnilistToken, setHasAnilistToken] = useState<boolean>(false);
  const [anilistTokenInput, setAnilistTokenInput] = useState("");
  const [viewer, setViewer] = useState<any>(null);

  useEffect(() => {
    invoke<boolean>("get_tmdb_token_status")
      .then(setHasToken)
      .catch(console.error);
      
    invoke<boolean>("get_anilist_token_status")
      .then(status => {
          setHasAnilistToken(status);
          if (status) {
              invoke("get_anilist_viewer").then(setViewer).catch(console.error);
          }
      })
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

  const saveAnilistToken = async () => {
    try {
      await invoke("save_anilist_token", { token: anilistTokenInput });
      setHasAnilistToken(true);
      setAnilistTokenInput("");
      invoke("get_anilist_viewer").then(setViewer).catch(console.error);
      invoke("sync_anilist_to_local").catch(console.error);
    } catch (err) {
      console.error(err);
    }
  };

  const removeAnilistToken = async () => {
    try {
      await invoke("delete_anilist_token");
      setHasAnilistToken(false);
      setViewer(null);
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
      {/* Account Connections */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-xl font-semibold border-b border-border pb-2">
          <LinkIcon className="w-5 h-5 text-primary" />
          <h2>Account Connections</h2>
        </div>
        <div className="bg-card p-6 rounded-lg border border-border space-y-4">
          <div>
            <label className="block text-sm font-medium mb-4">AniList Integration</label>
            {hasAnilistToken ? (
              <div className="flex items-center justify-between bg-secondary/50 p-4 rounded-lg">
                <div className="flex items-center gap-4">
                  {viewer?.avatar?.large ? (
                    <img src={viewer.avatar.large} alt="Avatar" className="w-12 h-12 rounded-full border-2 border-primary" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">?</div>
                  )}
                  <div>
                    <p className="font-semibold text-foreground">{viewer?.name || 'Connected User'}</p>
                    <div className="flex items-center gap-1 text-sm text-green-500">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Synchronized</span>
                    </div>
                  </div>
                </div>
                <button onClick={removeAnilistToken} className="bg-secondary text-secondary-foreground px-4 py-2 rounded-md font-medium hover:bg-secondary/80 transition-colors border border-border">
                  Disconnect
                </button>
              </div>
            ) : (
              <div>
                <p className="text-sm text-foreground/80 mb-4">
                  Connect your AniList account to enable two-way progress synchronization. Your lists will automatically sync when you watch episodes or read chapters.
                </p>
                <div className="flex gap-4 items-start">
                  <button 
                    onClick={async () => {
                      const url = await invoke<string>("get_anilist_auth_url");
                      window.open(url, "_blank");
                    }} 
                    className="bg-primary text-primary-foreground px-6 py-2 rounded-md font-medium hover:bg-primary/90 transition-colors whitespace-nowrap"
                  >
                    Connect AniList Account
                  </button>
                  <div className="flex-1 flex flex-col gap-2">
                    <p className="text-xs text-muted-foreground font-medium">Or paste access token manually:</p>
                    <div className="flex gap-2">
                      <input 
                        type="password" 
                        value={anilistTokenInput}
                        onChange={(e) => setAnilistTokenInput(e.target.value)}
                        placeholder="eyJ0eX..."
                        className="flex-1 bg-background border border-border rounded-md px-4 py-2 focus:outline-none focus:border-primary text-sm"
                      />
                      <button onClick={saveAnilistToken} className="bg-secondary text-secondary-foreground px-4 py-2 rounded-md font-medium hover:bg-secondary/80 transition-colors">
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
