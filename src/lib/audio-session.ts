/*
 * Persuade iOS to let this page make a sound.
 *
 * Two separate refusals stand between a web app and an audible turn instruction
 * on an iPhone, and they need different answers.
 *
 * 1. Autoplay. Nothing sounds until a real gesture has happened. Handled by
 *    doing all of this during the first tap of the visit.
 *
 * 2. The ringer switch. This is the one that made the voice look broken: with
 *    the phone on silent, iOS mutes Web Audio AND the speech engine, while
 *    leaving ordinary HTML <audio> playback alone. A rider whose phone is on
 *    silent — which is most riders — got a banner and nothing else, with no
 *    error anywhere to say why.
 *
 * The lever for the second one is the audio session category. `ambient`, the
 * default a page gets, is defined as "silenced by the ringer switch"; `playback`
 * is not. Safari 16.4 exposes it as `navigator.audioSession.type`; before that,
 * starting a looping HTML <audio> element is what moves the page into a
 * playback session, and that is the trick every audio library on the web ships.
 * Doing both costs nothing and covers both.
 *
 * Honest limit: none of this is a documented guarantee. Apple has never promised
 * a page can play through the ringer switch, and reports differ by iOS version.
 * `audioReport()` exists so a device that still refuses can SAY so, instead of
 * leaving the rider to guess whether the app is broken or the phone is on mute.
 */

type AudioSessionNavigator = Navigator & {
  audioSession?: { type: string };
};

let silent: HTMLAudioElement | null = null;
let sessionSet = false;
let silentPlaying = false;

/** A quarter second of digital silence, as a real WAV the audio element can loop. */
function silentWavUrl(): string {
  const rate = 8000;
  const samples = rate / 4;
  const buf = new ArrayBuffer(44 + samples);
  const view = new DataView(buf);
  const ascii = (at: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(at + i, s.charCodeAt(i));
  };
  ascii(0, "RIFF");
  view.setUint32(4, 36 + samples, true);
  ascii(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, rate, true);
  view.setUint32(28, rate, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  ascii(36, "data");
  view.setUint32(40, samples, true);
  // 0x80 is the zero level for unsigned 8-bit PCM. Zeroes would be a loud click.
  new Uint8Array(buf, 44).fill(0x80);
  return URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
}

/**
 * Move this page into a playback audio session. Call from inside a gesture;
 * safe to call as often as you like.
 */
export function unlockAudio(): void {
  if (typeof window === "undefined") return;

  if (!sessionSet) {
    const nav = navigator as AudioSessionNavigator;
    if (nav.audioSession) {
      try {
        /*
         * "playback", not "transient-solo".
         *
         * The spec offers transient-solo and describes it with driving
         * directions as the example, which sounds exactly right — but it is
         * defined to pause everything else, so every instruction would stop the
         * rider's music dead rather than talking over it. Playback ducks
         * instead, which is what a satnav should do, and is the category not
         * governed by the ringer switch.
         */
        nav.audioSession.type = "playback";
        sessionSet = true;
      } catch {
        /* older Safari, or a value it rejects — the element below still helps */
      }
    }
  }

  if (silentPlaying) return;
  try {
    if (!silent) {
      silent = document.createElement("audio");
      // Keeps this out of the lock screen's now-playing widget.
      silent.setAttribute("x-webkit-airplay", "deny");
      silent.preload = "auto";
      silent.loop = true;
      silent.src = silentWavUrl();
      silent.load();
    }
    void silent.play().then(
      () => {
        silentPlaying = true;
      },
      () => {
        silentPlaying = false;
      },
    );
  } catch {
    silentPlaying = false;
  }
}

/** Let go of the playback session when navigation ends. */
export function releaseAudio(): void {
  if (!silent) return;
  try {
    silent.pause();
  } catch {
    /* nothing to do */
  }
  silentPlaying = false;
}

/** What actually happened, for a self-test the rider can run on their own phone. */
export function audioReport(): {
  sessionApi: boolean;
  sessionType: string | null;
  silentLoop: boolean;
} {
  const nav = typeof navigator === "undefined" ? null : (navigator as AudioSessionNavigator);
  return {
    sessionApi: Boolean(nav?.audioSession),
    sessionType: nav?.audioSession?.type ?? null,
    silentLoop: silentPlaying,
  };
}
