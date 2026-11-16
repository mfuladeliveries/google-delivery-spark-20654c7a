let ringtone: HTMLAudioElement | null = null;

// Prepare within a customer gesture so mobile browsers can permit later alerts.
export function prepareCustomerArrivalSound(): void {
  if (!ringtone) ringtone = new Audio("/sounds/new-order.mp3");
  ringtone.preload = "auto";
  ringtone.muted = true;
  const audio = ringtone;
  void audio.play().then(() => {
    audio.pause();
    audio.currentTime = 0;
    audio.muted = false;
  }).catch(() => { audio.muted = false; });
}

export function playCustomerArrivalSound(): void {
  if (document.hidden) return;
  if (!ringtone) ringtone = new Audio("/sounds/new-order.mp3");
  ringtone.currentTime = 0;
  ringtone.loop = false;
  ringtone.muted = false;
  void ringtone.play().catch(() => { /* Device autoplay settings may prevent audio. */ });
  navigator.vibrate?.([400, 200, 400]);
}

export function stopCustomerArrivalSound(): void {
  ringtone?.pause();
  if (ringtone) ringtone.currentTime = 0;
}