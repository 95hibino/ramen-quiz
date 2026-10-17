/**
 * Cloudflare Turnstile (CAPTCHA) の確認ボックス。
 *
 * 会員登録・ログインのボット対策 (docs/SUPABASE_SETUP.md §31)。
 * 取得したトークンを Supabase Auth の `captchaToken` に渡すと、Supabase 側が
 * Cloudflare に問い合わせて検証する。トークンは 1 回しか使えないので、
 * 送信のたびに `reset()` で取り直すこと。
 *
 * `VITE_TURNSTILE_SITE_KEY` が未設定なら何も描画せず、呼び出し側は
 * トークン無しで送信する (Supabase 側の CAPTCHA も無効の環境を想定)。
 *
 * npm パッケージは使わず、Cloudflare 公式のスクリプトを読み込む。
 */
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim() ?? '';
const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

/** Turnstile を使う設定か。false なら確認ボックス無しで送信してよい。 */
export const TURNSTILE_ENABLED = SITE_KEY.length > 0;

interface TurnstileApi {
  render(
    container: HTMLElement,
    options: {
      sitekey: string;
      language?: string;
      callback: (token: string) => void;
      'expired-callback'?: () => void;
      'error-callback'?: () => void;
    },
  ): string;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<TurnstileApi> | null = null;

/** スクリプトはページ内で 1 回だけ読み込む。 */
function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.turnstile) resolve(window.turnstile);
      else reject(new Error('Turnstile の読み込みに失敗しました'));
    };
    script.onerror = () => {
      scriptPromise = null; // 次回のマウントで読み込み直せるようにする
      reject(new Error('Turnstile の読み込みに失敗しました'));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export interface TurnstileHandle {
  /** トークンを破棄して取り直す。送信後 (成功・失敗とも) に必ず呼ぶ。 */
  reset(): void;
}

interface TurnstileWidgetProps {
  /** トークン取得時は文字列、期限切れ・エラー時は null。 */
  onToken: (token: string | null) => void;
  /** スクリプトの読み込みや確認が失敗したときの案内表示用。 */
  onError?: (message: string) => void;
}

export const TurnstileWidget = forwardRef<TurnstileHandle, TurnstileWidgetProps>(
  function TurnstileWidget({ onToken, onError }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);
    // 親の再描画でコールバックが変わっても、確認ボックスを作り直さずに最新を呼ぶ
    const onTokenRef = useRef(onToken);
    const onErrorRef = useRef(onError);
    onTokenRef.current = onToken;
    onErrorRef.current = onError;

    useImperativeHandle(ref, () => ({
      reset() {
        onTokenRef.current(null);
        if (window.turnstile && widgetIdRef.current) {
          window.turnstile.reset(widgetIdRef.current);
        }
      },
    }));

    useEffect(() => {
      if (!TURNSTILE_ENABLED) return;
      let cancelled = false;
      loadTurnstile()
        .then((turnstile) => {
          if (cancelled || !containerRef.current) return;
          widgetIdRef.current = turnstile.render(containerRef.current, {
            sitekey: SITE_KEY,
            language: 'ja',
            callback: (token) => onTokenRef.current(token),
            'expired-callback': () => onTokenRef.current(null),
            'error-callback': () => {
              onTokenRef.current(null);
              onErrorRef.current?.(
                'ボット対策の確認に失敗しました。ページを再読み込みしてもう一度お試しください。',
              );
            },
          });
        })
        .catch(() => {
          onErrorRef.current?.(
            'ボット対策の確認ボックスを読み込めませんでした。通信環境を確認し、ページを再読み込みしてください。',
          );
        });
      return () => {
        cancelled = true;
        if (window.turnstile && widgetIdRef.current) {
          window.turnstile.remove(widgetIdRef.current);
        }
        widgetIdRef.current = null;
      };
    }, []);

    if (!TURNSTILE_ENABLED) return null;
    return <div ref={containerRef} className="flex min-h-[65px] justify-center" />;
  },
);
