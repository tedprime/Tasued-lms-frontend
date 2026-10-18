export type InstallPrompt = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
export let installPrompt: InstallPrompt | null = null;
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event as InstallPrompt;
  window.dispatchEvent(new Event("lms-install-ready"));
});
export function forgetInstallPrompt() {
  installPrompt = null;
}
