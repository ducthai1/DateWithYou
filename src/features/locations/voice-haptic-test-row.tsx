"use client";

import { useState } from "react";
import { Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { audioReport, unlockAudio } from "@/lib/audio-session";
import { buzz } from "@/lib/haptics";
import { hasVietnameseVoice, lastSpeechAttempt, speak } from "@/lib/speak";

/**
 * One press that tries the voice and the buzz, then says what the device did.
 *
 * This exists because the two things riders report as broken are the two things
 * a browser cannot be asked about. There is no API for "is the ringer switch
 * on", and a muted utterance still reports starting and ending normally — so a
 * silent phone and a broken feature look identical from inside the page, and
 * from here they looked identical to us too.
 *
 * What it can separate is worth having: whether a Vietnamese voice exists at
 * all, whether the engine accepted the utterance or errored, whether the page
 * managed to claim a playback audio session, and whether this browser has the
 * Vibration API or is relying on the iOS switch trick. When the report says the
 * engine ran cleanly and nothing was heard, the answer is on the side of the
 * phone, and the rider can be told exactly that instead of filing a bug.
 */

type Report = {
  vietnamese: boolean;
  voiceName: string | null;
  started: boolean;
  error: string | null;
  sessionType: string | null;
  silentLoop: boolean;
  vibrateApi: boolean;
  buzzResult: string;
};

const TEST_LINE = "Giọng chỉ đường đang hoạt động. Rẽ phải sau hai trăm mét.";

export function VoiceHapticTestRow() {
  const [report, setReport] = useState<Report | null>(null);
  const [running, setRunning] = useState(false);

  function run() {
    setRunning(true);
    setReport(null);
    // Everything that needs a gesture behind it happens on this press.
    unlockAudio();
    const buzzResult = buzz([60, 50, 60], { urgent: true });
    // With the chime, so what this plays is what a real instruction plays.
    speak(TEST_LINE, { chime: true });

    /*
     * Read the outcome after the engine has had time to start speaking.
     * `onstart` is what distinguishes "queued and forgotten" from "speaking",
     * and it does not fire in the same tick as the request.
     */
    window.setTimeout(() => {
      const attempt = lastSpeechAttempt();
      const audio = audioReport();
      setReport({
        vietnamese: hasVietnameseVoice(),
        voiceName: attempt.voiceName,
        started: attempt.started,
        error: attempt.error,
        sessionType: audio.sessionType,
        silentLoop: audio.silentLoop,
        vibrateApi: typeof navigator !== "undefined" && typeof navigator.vibrate === "function",
        buzzResult,
      });
      setRunning(false);
    }, 1400);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-foreground flex items-center gap-1.5 font-medium">
            <Volume2 className="h-4 w-4" /> Giọng chỉ đường &amp; rung
          </h3>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Chạm để nghe thử một câu và cảm nhận một nhịp rung.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={run} disabled={running}>
          {running ? "Đang thử…" : "Thử ngay"}
        </Button>
      </div>

      {report && (
        <div className="text-muted-foreground space-y-1 text-xs">
          <p>
            Giọng tiếng Việt:{" "}
            <strong className="text-foreground">
              {report.vietnamese ? (report.voiceName ?? "có") : "KHÔNG có trên máy này"}
            </strong>
          </p>
          <p>
            Bộ đọc:{" "}
            <strong className="text-foreground">
              {report.error ? `lỗi (${report.error})` : report.started ? "đã đọc" : "không khởi động"}
            </strong>
          </p>
          <p>
            Rung:{" "}
            <strong className="text-foreground">
              {report.vibrateApi ? "có Vibration API" : "iOS — dùng công tắc ẩn"} · {report.buzzResult}
            </strong>
          </p>
          <p>
            Phiên âm thanh:{" "}
            <strong className="text-foreground">
              {report.sessionType ?? "không đổi được"}
              {report.silentLoop ? " · đã giữ kênh phát" : ""}
            </strong>
          </p>
          {report.started && !report.error && (
            <p className="text-foreground bg-accent-soft/40 mt-1.5 rounded-lg p-2">
              Bộ đọc đã chạy xong mà bạn không nghe gì thì gần như chắc chắn là{" "}
              <strong>công tắc tắt tiếng</strong> bên hông máy đang bật — iPhone chặn cả giọng đọc của
              trang web khi ở chế độ im lặng. Gạt công tắc lên rồi thử lại.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
