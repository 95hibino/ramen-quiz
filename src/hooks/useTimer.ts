import { useCallback, useEffect, useRef, useState } from 'react';

interface UseTimerOptions {
  /** 初期残り秒数 (制限時間) */
  initialSec: number;
  /** タイマー実行中かどうか */
  isRunning: boolean;
  /** 0 秒になった瞬間に一度だけ呼ばれる */
  onExpire?: () => void;
}

interface UseTimerResult {
  remainingSec: number;
  /** initialSec にリセット (タイマーは isRunning に従う) */
  reset: () => void;
}

/**
 * シンプルなカウントダウンタイマー。
 * 1秒ごとに減算し、0 になったら onExpire を呼ぶ。
 */
export function useTimer({ initialSec, isRunning, onExpire }: UseTimerOptions): UseTimerResult {
  const [remainingSec, setRemainingSec] = useState(initialSec);
  const expiredRef = useRef(false);
  const onExpireRef = useRef(onExpire);

  // 最新の onExpire を参照するための ref 更新
  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  const reset = useCallback(() => {
    setRemainingSec(initialSec);
    expiredRef.current = false;
  }, [initialSec]);

  // initialSec が変わったら自動リセット (問題が切り替わったときに使う)
  useEffect(() => {
    reset();
  }, [reset]);

  useEffect(() => {
    if (!isRunning) return;
    if (remainingSec <= 0) return;
    const intervalId = window.setInterval(() => {
      setRemainingSec((prev) => {
        if (prev <= 1) {
          if (!expiredRef.current) {
            expiredRef.current = true;
            // タイマーコールバックは次のマイクロタスクで呼んでレンダリングと分離
            queueMicrotask(() => onExpireRef.current?.());
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, [isRunning, remainingSec]);

  return { remainingSec, reset };
}
