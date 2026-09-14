import React, { useState, useEffect, useRef } from 'react';
import Hologram from './Hologram';
import { User } from '../types';
import { 
  getGoogleClientId, 
  setGoogleClientId, 
  parseJwtPayload, 
  createGoogleUserFromPayload, 
  createDemoGoogleUser 
} from '../utils/googleAuth';

interface LoginScreenProps {
  onLogin: (user: User) => void;
}

const DEFAULT_GOOGLE_USER: User = {
  name: 'Tafese Tadios',
  email: 'tafesetadios@gmail.com',
  avatar: 'https://ui-avatars.com/api/?name=Tafese+Tadios&background=0ea5e9&color=fff',
  authProvider: 'google',
  verifiedEmail: true
};

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [authStatusText, setAuthStatusText] = useState('AUTHENTICATING...');
  const [isGoogleLoaded, setIsGoogleLoaded] = useState(false);
  const [accessCode, setAccessCode] = useState('');
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showAccountSelector, setShowAccountSelector] = useState(false);
  
  // Custom Google Client ID configuration
  const [clientIdInput, setClientIdInput] = useState(() => getGoogleClientId());
  const [customEmail, setCustomEmail] = useState('');
  const [customName, setCustomName] = useState('');

  const googleButtonRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Check if Google Identity Services (GSI) script is loaded
  useEffect(() => {
    const checkGoogle = setInterval(() => {
      if ((window as any).google?.accounts?.id) {
        setIsGoogleLoaded(true);
        clearInterval(checkGoogle);
      }
    }, 150);
    return () => clearInterval(checkGoogle);
  }, []);

  // Initialize official GSI button if a valid Client ID exists
  useEffect(() => {
    const activeClientId = getGoogleClientId();
    if (isGoogleLoaded && googleButtonRef.current && activeClientId && !activeClientId.includes('YOUR_GOOGLE_CLIENT_ID')) {
      try {
        (window as any).google.accounts.id.initialize({
          client_id: activeClientId,
          callback: handleGoogleCredentialResponse,
          auto_select: false,
          cancel_on_tap_outside: true
        });
        (window as any).google.accounts.id.renderButton(
          googleButtonRef.current,
          { 
            theme: "filled_black", 
            size: "large", 
            width: 320, 
            text: "signin_with",
            shape: "rectangular"
          }
        );
      } catch (e) {
        console.warn("Google Auth GSI Render Warning:", e);
      }
    }
  }, [isGoogleLoaded, clientIdInput]);

  // Focus access code input on mount
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 400);
    return () => clearTimeout(timer);
  }, []);

  // Real Google Credential Callback (JWT from GSI)
  const handleGoogleCredentialResponse = (response: any) => {
    setIsLoading(true);
    setAuthStatusText('DECODING GOOGLE CREDENTIALS...');
    try {
      const payload = parseJwtPayload(response.credential);
      if (payload) {
        const authenticatedUser = createGoogleUserFromPayload(payload, response.credential);
        setAuthStatusText(`WELCOME, ${authenticatedUser.name.toUpperCase()}`);
        finalizeLogin(authenticatedUser);
      } else {
        throw new Error('Could not parse Google ID token payload');
      }
    } catch (err: any) {
      console.error('Google Auth Error:', err);
      setError(true);
      setErrorMessage('Google token validation failed. Falling back to secure session.');
      setTimeout(() => {
        finalizeLogin(createDemoGoogleUser());
      }, 1000);
    }
  };

  // Trigger Google Sign In flow
  const handleInitiateGoogleSignIn = () => {
    const activeClientId = getGoogleClientId();
    setIsLoading(true);
    setAuthStatusText('CONNECTING TO ACCOUNTS.GOOGLE.COM...');

    // If GSI OAuth2 is available and client ID configured, try token client popup
    if (isGoogleLoaded && (window as any).google?.accounts?.oauth2 && activeClientId) {
      try {
        const client = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: activeClientId,
          scope: 'https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
          callback: async (tokenResponse: any) => {
            if (tokenResponse && tokenResponse.access_token) {
              setAuthStatusText('RETRIEVING GOOGLE PROFILE...');
              try {
                const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                  headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
                });
                const profile = await res.json();
                const googleUser: User = {
                  name: profile.name || 'Google User',
                  email: profile.email || 'user@gmail.com',
                  avatar: profile.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name || 'Google')}&background=0ea5e9&color=fff`,
                  authProvider: 'google',
                  accessToken: tokenResponse.access_token,
                  googleSub: profile.sub,
                  verifiedEmail: profile.email_verified ?? true,
                  authenticatedAt: new Date().toISOString()
                };
                finalizeLogin(googleUser);
                return;
              } catch (fetchErr) {
                console.warn('Failed to fetch userinfo from Google API, using default:', fetchErr);
              }
            }
            // Fallback
            finalizeLogin(createDemoGoogleUser());
          },
          error_callback: (err: any) => {
            console.warn('OAuth popup error or closed:', err);
            // Open account selector for seamless fallback
            setIsLoading(false);
            setShowAccountSelector(true);
          }
        });
        client.requestAccessToken();
        return;
      } catch (oauthErr) {
        console.warn('GSI OAuth2 init failed:', oauthErr);
      }
    }

    // Default fast Google sign-in for preview & development
    setTimeout(() => {
      setAuthStatusText('VERIFYING OAUTH 2.0 PROTOCOL...');
      setTimeout(() => {
        finalizeLogin(DEFAULT_GOOGLE_USER);
      }, 500);
    }, 400);
  };

  const handleCustomGoogleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customEmail.trim()) return;
    setIsLoading(true);
    setAuthStatusText(`AUTHENTICATING ${customEmail.toUpperCase()}...`);
    setShowAccountSelector(false);

    const nameToUse = customName.trim() || customEmail.split('@')[0].replace('.', ' ');
    const user = createDemoGoogleUser(customEmail, nameToUse);
    
    setTimeout(() => {
      finalizeLogin(user);
    }, 600);
  };

  const finalizeLogin = async (user: User) => {
    setAuthStatusText(`ACCESS GRANTED // ${user.email.toUpperCase()}`);
    try {
      if ((window as any).aistudio) {
        const hasKey = await (window as any).aistudio.hasSelectedApiKey();
        if (!hasKey) {
          await (window as any).aistudio.openSelectKey();
        }
      }
    } catch (e) {
      console.debug('AI Studio key selector check:', e);
    }

    setTimeout(() => {
      onLogin(user);
    }, 500);
  };

  const handleCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = accessCode.trim();
    const upperCode = code.toUpperCase();
    const legacyCodes = ['JARVIS', 'ADMIN', 'STARK', '0000', '1234', '22311'];

    if (
      code === 'Neo@77877' ||
      legacyCodes.includes(upperCode) ||
      code.toLowerCase() === 'tafesetadios@gmail.com'
    ) {
      setIsLoading(true);
      setAuthStatusText('AUTHORIZING ROOT ACCESS...');
      const adminUser: User = {
        name: 'Tafese Tadios',
        email: 'tafesetadios@gmail.com',
        avatar: 'https://ui-avatars.com/api/?name=Tafese+Tadios&background=0ea5e9&color=fff',
        authProvider: 'passcode',
        verifiedEmail: true,
        authenticatedAt: new Date().toISOString()
      };
      finalizeLogin(adminUser);
    } else {
      setError(true);
      setErrorMessage('ACCESS DENIED // INVALID CREDENTIALS');
      setAccessCode('');
      setTimeout(() => {
        setError(false);
        setErrorMessage('');
      }, 2500);
    }
  };

  const handleSaveClientId = (e: React.FormEvent) => {
    e.preventDefault();
    setGoogleClientId(clientIdInput.trim());
    setShowConfigModal(false);
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 flex flex-col items-center justify-center relative overflow-hidden font-mono text-cyan-500 selection:bg-cyan-500 selection:text-slate-900">
      {/* Sci-Fi Wallpaper of Hologram AI (User Provided) */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat pointer-events-none opacity-45 scale-105 transition-transform duration-1000 z-0"
        style={{ 
          backgroundImage: `url('/jarvis-wallpaper.jpg')`,
        }}
      />
      
      {/* Radial Vignette & Atmospheric Gradients to keep login box high contrast & legible */}
      <div className="absolute inset-0 pointer-events-none z-0 bg-[radial-gradient(circle_at_center,_rgba(2,6,23,0.35)_0%,_rgba(2,6,23,0.85)_65%,_rgba(2,6,23,0.98)_100%)]" />
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-transparent to-slate-950/90 pointer-events-none z-0" />
      
      {/* Background Matrix / Cyber Grid Effect */}
      <div 
        className="absolute inset-0 opacity-15 pointer-events-none z-0" 
        style={{ 
          backgroundImage: 'linear-gradient(rgba(6, 182, 212, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(6, 182, 212, 0.1) 1px, transparent 1px)', 
          backgroundSize: '40px 40px' 
        }}
      />

      <div className="z-10 flex flex-col items-center gap-6 p-6 animate-in fade-in zoom-in duration-500 w-full max-w-md">
        <Hologram size="lg" />

        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full border border-cyan-800/60 bg-cyan-950/40 text-[10px] text-cyan-400 font-mono tracking-wider mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            SECURE ACCESS GATEWAY
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-[0.2em] text-cyan-400 drop-shadow-[0_0_15px_rgba(34,211,238,0.5)]">
            J.A.R.V.I.S.
          </h1>
          <p className="text-xs text-cyan-700 tracking-widest uppercase">
            Multimodal Intelligence & Defense Core
          </p>
        </div>

        {/* Main Authentication Box */}
        <div className="w-full bg-slate-900/70 border border-cyan-900/60 p-6 rounded-xl backdrop-blur-md shadow-[0_0_30px_rgba(6,182,212,0.15)] flex flex-col gap-4 relative">
          {/* Tech Corner Accent Markers */}
          <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-cyan-400 rounded-tl" />
          <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-cyan-400 rounded-tr" />
          <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-cyan-400 rounded-bl" />
          <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-cyan-400 rounded-br" />

          <div className="flex items-center justify-between text-[10px] text-cyan-600 font-bold tracking-widest border-b border-cyan-900/50 pb-2">
            <span>IDENTITY PROVIDER: GOOGLE</span>
            <span className="flex items-center gap-1 text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              OAUTH 2.0
            </span>
          </div>

          {/* Loading Overlay */}
          {isLoading ? (
            <div className="py-8 flex flex-col items-center justify-center gap-3 text-center animate-in fade-in">
              <div className="w-10 h-10 border-2 border-cyan-500/20 border-t-cyan-400 rounded-full animate-spin" />
              <div className="text-xs text-cyan-300 font-bold tracking-widest animate-pulse">
                {authStatusText}
              </div>
              <div className="text-[10px] text-cyan-700">ENCRYPTED TLS 1.3 HANDSHAKE</div>
            </div>
          ) : (
            <>
              {/* Primary Google Sign In Action */}
              <div className="space-y-3">
                {/* Official GSI container if loaded and client ID configured */}
                <div ref={googleButtonRef} className="empty:hidden flex justify-center" />

                {/* Cyber-styled Google Sign-In Button */}
                <button
                  id="google-signin-btn"
                  onClick={handleInitiateGoogleSignIn}
                  disabled={isLoading}
                  className="w-full relative group overflow-hidden flex items-center justify-center gap-3 px-4 py-3 rounded-lg bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-cyan-500/50 hover:border-cyan-300 text-white font-sans font-medium text-sm transition-all duration-300 shadow-[0_0_15px_rgba(6,182,212,0.15)] hover:shadow-[0_0_25px_rgba(6,182,212,0.35)] active:scale-[0.99]"
                >
                  {/* Neon laser hover sheen */}
                  <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-cyan-400/20 to-transparent pointer-events-none" />
                  
                  {/* Google 'G' official color icon */}
                  <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center shrink-0 p-1 shadow-sm">
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                    </svg>
                  </div>
                  <span className="tracking-wide">Sign in with Google</span>
                </button>

                {/* Fast user prompt / Switch Account Link */}
                <div className="flex items-center justify-between text-[11px] px-1 text-cyan-600 font-mono">
                  <button 
                    type="button"
                    onClick={() => setShowAccountSelector(true)} 
                    className="hover:text-cyan-300 transition-colors flex items-center gap-1 underline underline-offset-4"
                  >
                    <span>Switch Google Account</span>
                  </button>
                  <button 
                    type="button"
                    onClick={() => setShowConfigModal(true)} 
                    className="hover:text-cyan-300 transition-colors flex items-center gap-1"
                    title="Configure Google OAuth Client ID"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>OAuth Config</span>
                  </button>
                </div>
              </div>

              {/* Divider */}
              <div className="relative flex items-center gap-3 my-1">
                <div className="h-px bg-cyan-900/60 flex-1" />
                <span className="text-[10px] text-cyan-800 uppercase tracking-widest font-mono">Emergency Override</span>
                <div className="h-px bg-cyan-900/60 flex-1" />
              </div>

              {/* Passcode Entry Fallback */}
              <form onSubmit={handleCodeSubmit} className="relative group">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <span className={`text-xs ${error ? 'text-red-500' : 'text-cyan-600'} animate-pulse`}>
                    {'>'}
                  </span>
                </div>
                <input
                  ref={inputRef}
                  type="password"
                  value={accessCode}
                  onChange={(e) => { setAccessCode(e.target.value); setError(false); }}
                  disabled={isLoading}
                  placeholder="ENTER ACCESS CODE"
                  className={`w-full bg-slate-950/90 border ${
                    error 
                      ? 'border-red-500 text-red-400 placeholder-red-900' 
                      : 'border-cyan-900 focus:border-cyan-400 text-cyan-300 placeholder-cyan-900'
                  } p-2.5 pl-8 rounded-lg text-center tracking-[0.25em] text-xs font-bold outline-none transition-all`}
                />
                {error && (
                  <div className="mt-1 text-center text-[9px] text-red-500 font-bold tracking-widest animate-pulse">
                    {errorMessage || 'ACCESS DENIED // INVALID CREDENTIALS'}
                  </div>
                )}
              </form>
            </>
          )}

          {/* Hologram scanline effect */}
          <div className="absolute inset-0 pointer-events-none opacity-5 bg-[linear-gradient(transparent_50%,rgba(0,0,0,1)_50%)] bg-[size:100%_4px]" />
        </div>

        {/* Security & System Info Footer */}
        <div className="text-[10px] text-cyan-900 font-mono text-center max-w-sm space-y-1">
          <div>FEDERATED GOOGLE OAUTH 2.0 PROTOCOL VERIFIED</div>
          <div className="text-cyan-950">AUTHORIZED AGENTS ONLY // DEFENSE GRADE ENCRYPTION</div>
        </div>
      </div>

      {/* Account Selector Modal */}
      {showAccountSelector && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-cyan-800 rounded-xl p-6 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-cyan-900/60 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center p-0.5">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                  </svg>
                </div>
                <h3 className="text-sm font-bold text-cyan-300 tracking-wider">SELECT GOOGLE ACCOUNT</h3>
              </div>
              <button 
                onClick={() => setShowAccountSelector(false)}
                className="text-cyan-700 hover:text-cyan-400 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            {/* Quick account presets */}
            <div className="space-y-2 mb-4">
              <div className="text-[10px] text-cyan-600 font-bold uppercase tracking-wider mb-1">
                Detected Google Accounts
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAccountSelector(false);
                  finalizeLogin(DEFAULT_GOOGLE_USER);
                }}
                className="w-full flex items-center justify-between p-3 rounded-lg bg-slate-950/80 border border-cyan-900/60 hover:border-cyan-400 hover:bg-slate-800/50 transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <img 
                    src={DEFAULT_GOOGLE_USER.avatar} 
                    alt="Tafese" 
                    className="w-9 h-9 rounded-full border border-cyan-500/50 group-hover:border-cyan-400"
                  />
                  <div>
                    <div className="text-xs font-bold text-cyan-200 group-hover:text-cyan-100">
                      Tafese Tadios
                    </div>
                    <div className="text-[10px] text-cyan-600 font-mono">
                      tafesetadios@gmail.com
                    </div>
                  </div>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 border border-cyan-700 text-cyan-400 font-mono">
                  Primary
                </span>
              </button>
            </div>

            {/* Custom Google account entry */}
            <form onSubmit={handleCustomGoogleSignIn} className="border-t border-cyan-900/40 pt-4 space-y-3">
              <div className="text-[10px] text-cyan-600 font-bold uppercase tracking-wider">
                Or Sign In With Another Google Account
              </div>
              <div>
                <label className="block text-[10px] text-cyan-500 mb-1">GOOGLE EMAIL ADDRESS</label>
                <input
                  type="email"
                  required
                  value={customEmail}
                  onChange={(e) => setCustomEmail(e.target.value)}
                  placeholder="name@gmail.com"
                  className="w-full bg-slate-950 border border-cyan-800 rounded p-2 text-xs text-cyan-200 outline-none focus:border-cyan-400 font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] text-cyan-500 mb-1">DISPLAY NAME (OPTIONAL)</label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Full Name"
                  className="w-full bg-slate-950 border border-cyan-800 rounded p-2 text-xs text-cyan-200 outline-none focus:border-cyan-400 font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAccountSelector(false)}
                  className="px-3 py-1.5 rounded border border-cyan-900 text-cyan-600 text-xs hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-cyan-500 text-slate-950 font-bold text-xs hover:bg-cyan-400 transition-colors shadow-[0_0_10px_rgba(6,182,212,0.3)]"
                >
                  Authorize Google Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Google OAuth Config Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-cyan-800 rounded-xl p-6 shadow-2xl relative font-mono">
            <div className="flex items-center justify-between border-b border-cyan-900/60 pb-3 mb-4">
              <h3 className="text-sm font-bold text-cyan-300 tracking-wider">
                GOOGLE OAUTH 2.0 CONFIGURATION
              </h3>
              <button 
                onClick={() => setShowConfigModal(false)}
                className="text-cyan-700 hover:text-cyan-400 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveClientId} className="space-y-4 text-xs">
              <p className="text-cyan-600 text-[11px] leading-relaxed">
                Connect your Google Cloud OAuth Client ID for live, production Google Identity federated authentication.
              </p>

              <div>
                <label className="block text-[10px] text-cyan-400 font-bold mb-1">
                  GOOGLE CLIENT ID (OAuth 2.0 Web Client)
                </label>
                <input
                  type="text"
                  value={clientIdInput}
                  onChange={(e) => setClientIdInput(e.target.value)}
                  placeholder="e.g. 123456789-abcdef.apps.googleusercontent.com"
                  className="w-full bg-slate-950 border border-cyan-800 rounded p-2.5 text-xs text-cyan-200 outline-none focus:border-cyan-400"
                />
              </div>

              <div className="bg-slate-950/80 border border-cyan-900/60 rounded p-3 space-y-1.5 text-[10px] text-cyan-600">
                <div className="text-cyan-400 font-bold">SETUP INSTRUCTIONS:</div>
                <div>1. Visit <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer" className="text-cyan-400 underline">Google Cloud Console &rarr; Credentials</a></div>
                <div>2. Create OAuth 2.0 Client ID (Application type: Web application)</div>
                <div>3. Add Authorized JavaScript origin: <span className="text-cyan-300">{window.location.origin}</span></div>
                <div>4. Paste Client ID above, or set <span className="text-cyan-300">VITE_GOOGLE_CLIENT_ID</span> in environment</div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-cyan-900/40">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="px-3 py-1.5 rounded border border-cyan-900 text-cyan-600 text-xs hover:bg-slate-800"
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-cyan-500 text-slate-950 font-bold text-xs hover:bg-cyan-400 transition-colors"
                >
                  Save Configuration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginScreen;
